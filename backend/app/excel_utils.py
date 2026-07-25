import io

from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def xlsx_response(filename, sheet_name, columns, rows):
    """columns: list of (header, key, width). rows: list of dict."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name

    for idx, (header, _key, width) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=idx, value=header)
        cell.font = Font(bold=True)
        ws.column_dimensions[cell.column_letter].width = width

    for row in rows:
        ws.append([row.get(key, "") for _header, key, _width in columns])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type=XLSX_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
