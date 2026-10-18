"""Local-only Spark GPU worker: batched trained swim actor and multilingual ASR."""
import os,json,subprocess,asyncio
from pathlib import Path
import numpy as np
import torch
from fastapi import FastAPI,Request,HTTPException
from transformers import AutoProcessor,AutoModelForSpeechSeq2Seq

ROOT=Path(__file__).resolve().parents[1]
if not torch.cuda.is_available():raise RuntimeError('Spark CUDA is required for this GPU worker')
torch.set_num_threads(2)
device=torch.device('cuda');dtype=torch.float16
policy=json.loads((ROOT/'assets/policy/swim-ppo-v42.json').read_text())
layers=[(torch.tensor(l['weights'],device=device),torch.tensor(l['bias'],device=device)) for l in policy['layers']]
model_path=os.environ.get('WHISPER_MODEL','openai/whisper-small')
processor=AutoProcessor.from_pretrained(model_path,local_files_only=Path(model_path).exists())
asr=AutoModelForSpeechSeq2Seq.from_pretrained(model_path,torch_dtype=dtype,local_files_only=Path(model_path).exists()).to(device).eval()
app=FastAPI(docs_url=None,redoc_url=None);asr_slots=asyncio.Semaphore(1);pending=0

@app.get('/health')
def health():return {'ready':True,'device':torch.cuda.get_device_name(),'policy':'swim-ppo-v42','asr':'Whisper small multilingual','cuda':True}

@app.post('/policy')
async def infer(request:Request):
    data=await request.json();obs=data.get('observations',[])
    if not isinstance(obs,list) or len(obs)>8 or any(len(x)!=282 for x in obs):raise HTTPException(400,'Invalid actor batch')
    if not obs:return {'actions':[]}
    with torch.inference_mode():
        x=torch.tensor(obs,dtype=torch.float32,device=device)
        if not torch.isfinite(x).all():raise HTTPException(400,'Nonfinite observation')
        for w,b in layers:x=torch.tanh(torch.nn.functional.linear(x,w,b))
        actions=x.cpu().tolist()
    return {'actions':actions,'device':'cuda'}

def transcribe(data):
    ff=os.environ.get('FFMPEG','ffmpeg')
    try:r=subprocess.run([ff,'-v','error','-i','pipe:0','-t','15','-ar','16000','-ac','1','-f','f32le','pipe:1'],input=data,capture_output=True,timeout=20,check=True)
    except Exception:raise ValueError('無法讀取錄音，請重新錄製。')
    audio=np.frombuffer(r.stdout,dtype=np.float32)
    if len(audio)<1600 or np.sqrt(np.mean(audio**2))<.002:return ''
    features=processor(audio,sampling_rate=16000,return_tensors='pt').input_features.to(device,dtype)
    with torch.inference_mode():tokens=asr.generate(features,max_new_tokens=128,num_beams=3,task='transcribe')
    return processor.batch_decode(tokens,skip_special_tokens=True)[0].strip()

@app.post('/transcribe')
async def speech(request:Request):
    global pending
    if pending>=4:raise HTTPException(429,'語音轉錄忙碌中，請稍後重試。')
    data=await request.body()
    if not data or len(data)>4*1024*1024:raise HTTPException(413,'錄音太長，請錄製 12 秒內。')
    pending+=1
    try:
        async with asr_slots:
            try:text=await asyncio.to_thread(transcribe,data)
            except ValueError as e:raise HTTPException(400,str(e))
        return {'text':text,'device':'cuda'}
    finally:pending-=1

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=int(os.environ.get('GPU_PORT','8877')),access_log=False)
