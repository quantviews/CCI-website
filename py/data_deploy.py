from pathlib import Path
import subprocess
from ftplib import FTP
import sys
import os 

# Add /py to import path and import validation
sys.path.append("py")
from validate_excel import validate_excel

# === Basic paths (relative to project root) ===
ROOT = Path.cwd()
WATCHED_FILE = ROOT / "data" / "Исходные данные.xlsx"
MARKETS_DIR = ROOT / "docs" / "markets"

# === FTP Configuration ===
FTP_HOST = os.getenv("FTP_HOST")
FTP_USER = os.getenv("FTP_USER")
FTP_PASS = os.getenv("FTP_PASS")
FTP_TARGET_DIR = "/pbc-index.ru/docs/markets"

# === Quarto render ===

def render_quarto():
    print("🛠 Rendering Quarto project with filtered output...\n")
    process = subprocess.Popen(
        ["quarto", "render", "markets"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1,
    )

    for line in process.stdout:
        if "DEBUG" not in line:  # suppress debug noise
            print(line, end="")

    process.stdout.close()
    returncode = process.wait()

    if returncode != 0:
        print(f"\n❌ Quarto render failed with exit code {returncode}")
        return False

    print("\n✅ Quarto render completed successfully.")
    return True
    
def upload_html_files():
    print("📤 Uploading HTML files via FTP...")
    ftp = FTP(FTP_HOST)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.cwd(FTP_TARGET_DIR)

    for file in MARKETS_DIR.glob("*.html"):
        with file.open("rb") as f:
            ftp.storbinary(f"STOR " + file.name, f)
            print(f"Uploaded: {file.name}")

    ftp.quit()
    print("✅ FTP upload done.")

def main():
    if not validate_excel(WATCHED_FILE):
        print("❌ Validation failed. Aborting.")
        return

    if not render_quarto():
        print("❌ Render failed. Aborting.")
        return

    upload_html_files()

if __name__ == "__main__":
    main()
