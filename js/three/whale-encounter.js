export const encounterTiming=Object.freeze({arrival:3,stay:10,departure:2.8});
export const whaleVisits=Object.freeze([
 {name:'左上方',start:[-6.5,-2.5,-10],bend:[-4,2.8,-6],stop:[-2.2,1.0,-3.5],exit:[-8,6,-15],pose:[-.30,-1.02,-.15],scale:.78,near:.35,tempo:1.16,bias:-.7,phase:.4,wave:.90},
 {name:'右上方',start:[6.5,-2,-11],bend:[4.5,3,-6],stop:[2.1,1.2,-3.7],exit:[8,6,-14],pose:[.24,-2.08,.10],scale:.80,near:.40,tempo:1.30,bias:.8,phase:2.0,wave:1.08},
 {name:'上方峽谷',start:[-3,7,-10],bend:[-2,4,-5.5],stop:[-1.3,2,-3.1],exit:[-5,8,-15],pose:[-.45,-1.22,-.30],scale:.84,near:.53,tempo:1.08,bias:-.4,phase:3.2,wave:.82},
 {name:'下方深藍',start:[4,-7,-12],bend:[3,-2.5,-6],stop:[1.7,-.45,-3.0],exit:[7,4,-15],pose:[.30,-1.96,.24],scale:.86,near:.58,tempo:1.40,bias:.5,phase:4.4,wave:1.12},
 {name:'左側近距離',start:[-6,1,-15],bend:[-4,.8,-7],stop:[-1.1,.35,-1.8],exit:[-9,5,-14],pose:[-.20,-1.18,-.10],scale:.96,near:.95,tempo:1.20,bias:-.9,phase:5.2,wave:1.0},
 {name:'右側近距離',start:[6,3,-15],bend:[4.5,2,-7],stop:[1.4,.55,-2.0],exit:[9,6,-15],pose:[.36,-1.96,.05],scale:1.0,near:1,tempo:1.06,bias:.9,phase:1.3,wave:.88}
]);
export class WhaleEncounter{
 constructor(random=Math.random){this.random=random;this.bag=[];this.lastIndex=-1;this.reset()}
 reset(){this.state='hidden';this.elapsed=0;this.started=0;this.profile=null;}
 start(now=0){if(this.state!=='hidden')return false;if(!this.bag.length){this.bag=whaleVisits.map((_,i)=>i);for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]]}if(this.bag.at(-1)===this.lastIndex)[this.bag[0],this.bag[this.bag.length-1]]=[this.bag[this.bag.length-1],this.bag[0]];}this.lastIndex=this.bag.pop();this.profile=whaleVisits[this.lastIndex];this.started=now;this.elapsed=0;this.state='approaching';return true;}
 advance(dt,now=this.started){if(this.state==='hidden')return this.snapshot();this.elapsed=Math.max(this.elapsed+Math.max(dt,0),now-this.started);const a=encounterTiming.arrival,s=encounterTiming.stay,d=encounterTiming.departure;this.state=this.elapsed<a?'approaching':this.elapsed<a+s?'following':this.elapsed<a+s+d?'departing':'hidden';return this.snapshot()}
 snapshot(){const {arrival:a,stay:s,departure:d}=encounterTiming;return{state:this.state,elapsed:this.elapsed,arrival:Math.min(1,this.elapsed/a),stay:Math.max(0,Math.min(s,this.elapsed-a)),departure:Math.max(0,Math.min(1,(this.elapsed-a-s)/d)),profile:this.profile};}
}
