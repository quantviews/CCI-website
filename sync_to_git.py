import subprocess
from pathlib import Path

# === Настройки ===
REPO_DIR = Path(__file__).resolve().parent
MARKETS_QMD = REPO_DIR / "markets"
DOCS_MARKETS = REPO_DIR / "docs" / "markets"

# === Команды ===
def run(cmd):
    print(f"→ {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        raise RuntimeError(f"❌ Команда не удалась: {cmd}")

# === Логика ===

print("📦 Добавляем изменённые .qmd и .html файлы в git...")
run(f'git add {MARKETS_QMD}/*.qmd')
run(f'git add {DOCS_MARKETS}/*.html')

print("📝 Делаем коммит...")
run('git commit -m "Update: markets qmd and rendered html (local render)"')

print("🚀 Отправляем в удалённый репозиторий...")
run('git push')

print("✅ Готово. Изменения синхронизированы с GitHub.")
