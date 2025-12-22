from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pypdf import PdfReader
import io
from fastapi.responses import StreamingResponse
from app.services.parser import parser
from app.services.report import build_pdf_report
from app.schemas import ParsingResult
import json
from fastapi import status

router = APIRouter()

@router.post("/upload", response_model=ParsingResult)
async def upload_regulation(
    file: UploadFile = File(...),
    detection_rules: str = Form(default=None),
):
    content = ""
    parsed_detection_rules = None

    if detection_rules:
        try:
            parsed_detection_rules = json.loads(detection_rules)
            if not isinstance(parsed_detection_rules, list):
                raise ValueError("detection_rules must be a list")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid detection_rules: {str(e)}")
    
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
    items = parser.parse(content, detection_rules=parsed_detection_rules)
    
    return ParsingResult(
        filename=file.filename,
        total_items=len(items),
        items=items
    )


@router.post("/report")
async def generate_report(
    file: UploadFile = File(...),
    detection_rules: str = Form(default=None),
    tasks: str = Form(default=None),
):
    content = ""
    parsed_detection_rules = None
    parsed_tasks = None

    if detection_rules:
        try:
            parsed_detection_rules = json.loads(detection_rules)
            if not isinstance(parsed_detection_rules, list):
                raise ValueError("detection_rules must be a list")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid detection_rules: {str(e)}")

    if tasks:
        try:
            parsed_tasks = json.loads(tasks)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid tasks payload: {str(e)}")
    
    if file.filename.lower().endswith(".pdf"):
        try:
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
            try:
                content = content_bytes.decode("latin-1")
            except Exception:
                 raise HTTPException(status_code=400, detail="Could not decode text file. Please ensure it is UTF-8 or ASCII.")
        
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .pdf or .txt")

    if not content.strip():
        raise HTTPException(status_code=400, detail="Empty file or no text extracted.")

    items = parser.parse(content, detection_rules=parsed_detection_rules)
    try:
        pdf_bytes = build_pdf_report(
            file.filename,
            items,
            detection_rules=parsed_detection_rules,
            tasks_data=parsed_tasks,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{file.filename}-report.pdf"'}
    )
