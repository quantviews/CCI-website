import pandas as pd

REQUIRED_COLUMNS = ["Дата", "Год", "Месяц", "Данные", "Наименование показателя"]

def validate_excel(file_path):
    try:
        df = pd.read_excel(file_path, sheet_name="Рынки")

        # Check required columns
        if not all(col in df.columns for col in REQUIRED_COLUMNS):
            missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
            raise ValueError(f"❌ Missing required columns: {missing}")

        # Ensure 'Дата' is datetime
        df["Дата"] = pd.to_datetime(df["Дата"], errors='coerce')
        if df["Дата"].isnull().any():
            raise ValueError("❌ Some 'Дата' values could not be parsed as dates.")

        # Normalize 'Данные' to float
        if df["Данные"].dtype == object:
            df["Данные"] = df["Данные"].astype(str).str.replace(",", ".", regex=False)
        df["Данные"] = pd.to_numeric(df["Данные"], errors="coerce")

        if df[REQUIRED_COLUMNS].isnull().values.any():
            raise ValueError("❌ Excel file contains missing values.")

       # if (df["Данные"] < 0).any():
       #     raise ValueError("❌ Column 'Данные' contains negative numbers.")

        print("✅ Excel validation passed.")
        return True

    except Exception as e:
        print(f"❌ Excel validation failed: {e}")
        return False
