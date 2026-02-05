import os
import shutil
from datetime import datetime

# Source is current directory
source_dir = os.getcwd()

# Target is anciennes versions/v0.1
# Using 'ancienne version' as per user request (singular)
target_base = os.path.join(source_dir, 'ancienne version', 'v0.1')

# Ignore patterns (don't backup the backup, nor dotfiles, nor huge folders)
ignore_patterns = shutil.ignore_patterns(
    'ancienne version', 
    '.git', 
    '.gemini', 
    'node_modules',
    '__pycache__',
    '*.pyc'
)

print(f"Backing up to: {target_base}")

if os.path.exists(target_base):
    print("Backup directory already exists. Adding timestamp.")
    target_base = f"{target_base}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

try:
    shutil.copytree(source_dir, target_base, ignore=ignore_patterns, dirs_exist_ok=True)
    print("✅ Backup completed successfully.")
except Exception as e:
    print(f"❌ Backup failed: {e}")
