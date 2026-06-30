import json
from pathlib import Path
from typing import Any

import pandas as pd

STRUCTURED_EXTENSIONS = {".csv": "csv", ".xlsx": "excel", ".xls": "excel"}
SEMI_STRUCTURED_EXTENSIONS = {".xml": "xml", ".json": "json"}
UNSTRUCTURED_EXTENSIONS = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".txt": "txt",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
}

ALL_EXTENSIONS = {**STRUCTURED_EXTENSIONS, **SEMI_STRUCTURED_EXTENSIONS, **UNSTRUCTURED_EXTENSIONS}

DATAFRAME_FILE_TYPES = {"csv", "excel", "json", "xml"}
TEXT_FILE_TYPES = {"txt", "pdf", "docx", "image"}


class UnsupportedFileTypeError(Exception):
    pass


def detect_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALL_EXTENSIONS:
        raise UnsupportedFileTypeError(f"Unsupported file extension: {ext}")
    return ALL_EXTENSIONS[ext]


def detect_data_type(file_type: str) -> str:
    if file_type in ("csv", "excel"):
        return "structured"
    if file_type in ("xml", "json"):
        return "semi_structured"
    return "unstructured"


def load_dataframe(path: str, file_type: str) -> pd.DataFrame:
    if file_type == "csv":
        return pd.read_csv(path)
    if file_type == "excel":
        return pd.read_excel(path)
    if file_type == "json":
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return pd.json_normalize(data if isinstance(data, list) else [data])
    if file_type == "xml":
        return pd.read_xml(path)
    raise UnsupportedFileTypeError(f"{file_type} is not a tabular file type")


def load_text(path: str, file_type: str) -> str:
    if file_type == "txt":
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    if file_type == "pdf":
        import fitz  # PyMuPDF

        text = ""
        with fitz.open(path) as doc:
            for page in doc:
                text += page.get_text()
        return text
    if file_type == "docx":
        import docx

        document = docx.Document(path)
        return "\n".join(p.text for p in document.paragraphs)
    if file_type == "image":
        try:
            import pytesseract
            from PIL import Image

            return pytesseract.image_to_string(Image.open(path))
        except Exception:
            return ""
    raise UnsupportedFileTypeError(f"{file_type} is not a text-extractable file type")


def _dataframe_preview(df: pd.DataFrame) -> dict[str, Any]:
    head = df.head(10).fillna("").astype(str)
    return {
        "columns": [str(c) for c in df.columns.tolist()],
        "rows": head.to_dict(orient="records"),
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
    }


def parse_preview(path: str, file_type: str) -> dict[str, Any]:
    if file_type in DATAFRAME_FILE_TYPES:
        return _dataframe_preview(load_dataframe(path, file_type))
    if file_type in TEXT_FILE_TYPES:
        return {"text_preview": load_text(path, file_type)[:500]}
    raise UnsupportedFileTypeError(f"No parser for file type: {file_type}")


def save_upload(file_bytes: bytes, filename: str, user_id: str, upload_dir: str) -> tuple[str, int]:
    ext = Path(filename).suffix.lower()
    user_dir = Path(upload_dir) / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    import uuid

    stored_name = f"{uuid.uuid4()}{ext}"
    storage_path = user_dir / stored_name
    storage_path.write_bytes(file_bytes)
    return str(storage_path), len(file_bytes)
