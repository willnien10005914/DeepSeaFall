"""Rebuild the reviewed v3 girl without reverting to the historical template."""
import subprocess,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
def main():
    subprocess.run([sys.executable,str(ROOT/'assets/scripts/prepare_refined_girl.py')],cwd=ROOT,check=True)
    subprocess.run(['bash','scripts/run_refined_blender.sh','portrait','front','side','back','face-front'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,str(ROOT/'assets/scripts/export_refined_girl_usd.py')],cwd=ROOT,check=True)
    subprocess.run([sys.executable,str(ROOT/'assets/scripts/refine_whale_for_ocean.py')],cwd=ROOT,check=True)
if __name__=='__main__':main()
