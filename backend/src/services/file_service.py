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


def _dataframe_preview(df: pd.DataFrame) -> dict[str, Any]:
    head = df.head(10).fillna("").astype(str)
    return {
        "columns": [str(c) for c in df.columns.tolist()],
        "rows": head.to_dict(orient="records"),
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
    }


def parse_csv(path: str) -> dict[str, Any]:
    df = pd.read_csv(path)
    return _dataframe_preview(df)


def parse_excel(path: str) -> dict[str, Any]:
    df = pd.read_excel(path)
    return _dataframe_preview(df)


def parse_json_file(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    df = pd.json_normalize(data if isinstance(data, list) else [data])
    return _dataframe_preview(df)


def parse_xml(path: str) -> dict[str, Any]:
    df = pd.read_xml(path)
    return _dataframe_preview(df)


def parse_txt(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    return {"text_preview": text[:500]}


def parse_pdf(path: str) -> dict[str, Any]:
    import fitz  # PyMuPDF

    text = ""
    with fitz.open(path) as doc:
        for page in doc:
            text += page.get_text()
            if len(text) >= 500:
                break
    return {"text_preview": text[:500]}


def parse_docx(path: str) -> dict[str, Any]:
    import docx

    document = docx.Document(path)
    text = "\n".join(p.text for p in document.paragraphs)
    return {"text_preview": text[:500]}


def parse_image(path: str) -> dict[str, Any]:
    try:
        import pytesseract
        from PIL import Image

        text = pytesseract.image_to_string(Image.open(path))
    except Exception:
        text = ""
    return {"text_preview": text[:500]}


PARSERS = {
    "csv": parse_csv,
    "excel": parse_excel,
    "json": parse_json_file,
    "xml": parse_xml,
    "txt": parse_txt,
    "pdf": parse_pdf,
    "docx": parse_docx,
    "image": parse_image,
}


def parse_preview(path: str, file_type: str) -> dict[str, Any]:
    parser = PARSERS.get(file_type)
    if parser is None:
        raise UnsupportedFileTypeError(f"No parser for file type: {file_type}")
    return parser(path)


def save_upload(file_bytes: bytes, filename: str, user_id: str, upload_dir: str) -> tuple[str, int]:
    ext = Path(filename).suffix.lower()
    user_dir = Path(upload_dir) / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    import uuid

    stored_name = f"{uuid.uuid4()}{ext}"
    storage_path = user_dir / stored_name
    storage_path.write_bytes(file_bytes)
    return str(storage_path), len(file_bytes)
