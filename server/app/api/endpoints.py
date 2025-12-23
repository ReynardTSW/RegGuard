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
    effective_detection_rules = None

    if detection_rules:
        try:
            parsed_detection_rules = json.loads(detection_rules)
            if not isinstance(parsed_detection_rules, list):
                raise ValueError("detection_rules must be a list")
            effective_detection_rules = None if parser.is_default_rules(parsed_detection_rules) else parsed_detection_rules
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
    items = parser.parse(content, detection_rules=effective_detection_rules)

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
    rule_ids: str = Form(default=None),
    top_n: int = Form(default=None),
    severity_map: str = Form(default=None),
    score_cutoff: int = Form(default=None),
    severity_top_counts: str = Form(default=None),
):
    content = ""
    parsed_detection_rules = None
    parsed_tasks = None
    parsed_rule_ids = None
    parsed_severity_map = {}
    parsed_score_cutoff = None
    parsed_severity_top_counts = None
    effective_detection_rules = None

    if detection_rules:
        try:
            parsed_detection_rules = json.loads(detection_rules)
            if not isinstance(parsed_detection_rules, list):
                raise ValueError("detection_rules must be a list")
            effective_detection_rules = None if parser.is_default_rules(parsed_detection_rules) else parsed_detection_rules
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid detection_rules: {str(e)}")
    
    if tasks:
        try:
            parsed_tasks = json.loads(tasks)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid tasks payload: {str(e)}")

    if rule_ids:
        try:
            parsed_rule_ids = set(json.loads(rule_ids))
            if not isinstance(parsed_rule_ids, set):
                parsed_rule_ids = set(parsed_rule_ids)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid rule_ids payload: {str(e)}")

    if severity_map:
        try:
            parsed_severity_map = json.loads(severity_map) or {}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid severity_map payload: {str(e)}")
    
    if score_cutoff is not None:
        try:
            parsed_score_cutoff = int(score_cutoff)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid score_cutoff payload: {str(e)}")

    if severity_top_counts:
        try:
            parsed_severity_top_counts = json.loads(severity_top_counts)
            if not isinstance(parsed_severity_top_counts, dict):
                raise ValueError("severity_top_counts must be an object mapping severity to count")
            normalized = {}
            for key, val in parsed_severity_top_counts.items():
                if val is None or val == "":
                    continue
                try:
                    normalized[key.lower()] = max(0, int(val))
                except Exception:
                    continue
            parsed_severity_top_counts = normalized
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid severity_top_counts payload: {str(e)}")
    
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

    items = parser.parse(content, detection_rules=effective_detection_rules)
    # Filter items by provided rule ids and/or top-N
    if parsed_rule_ids is not None:
        items = [i for i in items if getattr(i, "control_id", None) in parsed_rule_ids]

    # Override severities with client-visible values when provided
    if parsed_severity_map:
        for item in items:
            cid = getattr(item, "control_id", None)
            if cid and cid in parsed_severity_map:
                item.severity = parsed_severity_map[cid]

    if parsed_score_cutoff is not None:
        items = [i for i in items if getattr(i, "score", 0) >= parsed_score_cutoff]

    if parsed_severity_top_counts:
        grouped = {}
        for item in items:
            key = (getattr(item, "severity", None) or "unknown").lower()
            grouped.setdefault(key, []).append(item)
        limited = []
        ordered_keys = ["high", "critical", "medium", "low", "unknown"]
        seen_keys = set()
        for key in ordered_keys:
            bucket = grouped.get(key, [])
            seen_keys.add(key)
            sorted_bucket = sorted(bucket, key=lambda x: getattr(x, "score", 0), reverse=True)
            limit = parsed_severity_top_counts.get(key)
            if limit is None:
                limited.extend(sorted_bucket)
            elif limit > 0:
                limited.extend(sorted_bucket[:limit])
            # limit == 0 skips the bucket
        # any remaining severities not explicitly ordered
        for key, bucket in grouped.items():
            if key in seen_keys:
                continue
            sorted_bucket = sorted(bucket, key=lambda x: getattr(x, "score", 0), reverse=True)
            limit = parsed_severity_top_counts.get(key)
            if limit is None:
                limited.extend(sorted_bucket)
            elif limit > 0:
                limited.extend(sorted_bucket[:limit])
        items = limited

    if top_n:
        try:
            n = int(top_n)
            if n > 0:
                items = sorted(items, key=lambda x: getattr(x, "score", 0), reverse=True)[:n]
        except Exception:
            pass

    # Filter tasks to only include selected rules
    if parsed_rule_ids is not None and parsed_tasks and isinstance(parsed_tasks, dict):
        filtered_columns = {}
        for col, arr in (parsed_tasks.get("columns") or {}).items():
            filtered_columns[col] = [r for r in (arr or []) if (r.get("control_id") if isinstance(r, dict) else getattr(r, "control_id", None)) in parsed_rule_ids]
        filtered_steps = {rid: steps for rid, steps in (parsed_tasks.get("steps") or {}).items() if rid in parsed_rule_ids}
        parsed_tasks = {**parsed_tasks, "columns": filtered_columns, "steps": filtered_steps}

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
