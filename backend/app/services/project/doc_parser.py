import os
import logging

logger = logging.getLogger(__name__)

def extract_text_from_file(file_path: str, filename: str) -> str:
    """
    Extracts text content from supported document files (.pdf, .docx, .md, .txt).
    Raises ValueError for unreadable, encrypted, empty, or image-only files.
    """
    if not os.path.exists(file_path):
        raise ValueError("Document file not found on server disk.")

    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "pdf":
        import pypdf
        try:
            reader = pypdf.PdfReader(file_path)
            if reader.is_encrypted:
                raise ValueError("PDF file is password protected or encrypted.")
            
            pages_text = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    pages_text.append(txt.strip())
            
            full_text = "\n\n".join(pages_text).strip()
            if not full_text:
                raise ValueError("PDF file contains no selectable text (image-only / scanned file).")
            return full_text
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error reading PDF file {filename}: {e}")
            raise ValueError(f"Failed to parse PDF file format: {str(e)}")

    elif ext == "docx":
        import docx
        try:
            doc = docx.Document(file_path)
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            full_text = "\n".join(paragraphs).strip()
            if not full_text:
                raise ValueError("DOCX document contains no text.")
            return full_text
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error reading DOCX file {filename}: {e}")
            raise ValueError(f"Failed to parse DOCX file format: {str(e)}")

    elif ext in ["txt", "md"]:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                full_text = f.read().strip()
            if not full_text:
                raise ValueError("Text file is empty.")
            return full_text
        except Exception as e:
            logger.error(f"Error reading text file {filename}: {e}")
            raise ValueError(f"Failed to read text file: {str(e)}")

    else:
        raise ValueError(f"Unsupported file extension '.{ext}'. Supported formats: .pdf, .docx, .md, .txt")
