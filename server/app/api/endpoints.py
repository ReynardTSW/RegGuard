from fastapi import APIRouter, UploadFile, File, HTTPException
from pypdf import PdfReader
import io
from app.services.parser import parser
from app.schemas import ParsingResult

router = APIRouter()

@router.post("/upload", response_model=ParsingResult)
async def upload_regulation(file: UploadFile = File(...)):
    content = ""
    
    if file.filename.lower().endswith(".pdf"):
        try:
            # Read PDF content
            pdf_bytes = await file.read()
            pdf_file = io.BytesIO(pdf_bytes)
            reader = PdfReader(pdf_file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    content += text + "\n"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")
            
    elif file.filename.lower().endswith(".txt"):
        content_bytes = await file.read()
        try:
            content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback to older encodings or ignore errors
            try:
                content = content_bytes.decode("latin-1")
            except Exception:
                 raise HTTPException(status_code=400, detail="Could not decode text file. Please ensure it is UTF-8 or ASCII.")
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .pdf or .txt")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Empty file or no text extracted.")

    # Parse content
    items = parser.parse(content)
    
    return ParsingResult(
        filename=file.filename,
        total_items=len(items),
        items=items
    )
