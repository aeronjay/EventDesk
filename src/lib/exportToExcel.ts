import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Solicitation } from './solicitations'
import { fetchFieldConfigs } from './fieldConfigs'

const formatEventTime = (time?: string | null) => {
  if (!time) return null;
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return time;
  let hours = parseInt(match[1], 10);
  const mins = match[2];
  const ampmMatch = time.match(/(AM|PM)/i);
  let ampm = ampmMatch ? ampmMatch[1].toUpperCase() : (hours >= 12 ? 'PM' : 'AM');
  hours = hours % 12 || 12;
  return `${hours}:${mins} ${ampm}`;
};

export async function exportToExcel(solicitations: Solicitation[]) {
  const configs = await fetchFieldConfigs();
  const cnConfig = configs.find(c => c.field_name === 'control_number');
  const colorMappings = cnConfig?.color_mappings || [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QSolicit';
  workbook.created = new Date();

  const activeSolicitations = solicitations.filter(s => s.status !== 'Done' && s.status !== 'Discontinued');
  const historySolicitations = solicitations.filter(s => s.status === 'Done' || s.status === 'Discontinued');

  const headers = [
    { header: 'Type', key: 'type', width: 20 },
    { header: 'Control No.', key: 'control_number', width: 20 },
    { header: 'Barangay', key: 'barangay', width: 20 },
    { header: 'Date Received', key: 'date_received', width: 20 },
    { header: 'Organization', key: 'organization_name', width: 30 },
    { header: 'Sub Area', key: 'sub_area', width: 20 },
    { header: 'Event', key: 'event', width: 30 },
    { header: 'Date & Time', key: 'datetime', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Request', key: 'request', width: 35 },
    { header: 'Venue', key: 'venue', width: 25 },
    { header: 'Contact Person', key: 'contact_person', width: 25 },
    { header: 'Contact Number', key: 'contact_number', width: 20 },
    { header: 'Recom', key: 'recom', width: 20 },
    { header: 'Remarks', key: 'remarks', width: 30 },
    { header: 'Voters Turn Out', key: 'voters_turnout', width: 20 },
    { header: 'Additional Note', key: 'additional_note', width: 30 },
    { header: 'Attachments', key: 'attachments', width: 40 },
  ];

  const setupSheet = (sheetName: string, data: Solicitation[]) => {
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    sheet.columns = headers;

    // Style headers
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo color
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    data.forEach((s) => {
      const dateTimeStr = [
        s.event_date && new Date(s.event_date).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        formatEventTime(s.event_time)
      ].filter(Boolean).join(' at ');

      let attachmentsStr = '';
      if (s.attachments) {
        if (Array.isArray(s.attachments)) {
          attachmentsStr = s.attachments.map((a: any) => a.url || '').join('\n');
        } else if (typeof s.attachments === 'string') {
          try {
            const parsed = JSON.parse(s.attachments);
            if (Array.isArray(parsed)) {
              attachmentsStr = parsed.map((a: any) => a.url || '').join('\n');
            }
          } catch (e) {
            attachmentsStr = String(s.attachments);
          }
        }
      }

      const row = sheet.addRow({
        type: s.type || '',
        control_number: s.control_number || '',
        barangay: s.control_number_color || '',
        date_received: s.date_received
          ? new Date(s.date_received).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
          : '',
        organization_name: s.organization_name || '',
        sub_area: s.sub_area || '',
        event: s.event || '',
        datetime: dateTimeStr,
        status: s.status || '',
        request: s.request || '',
        venue: s.venue || '',
        contact_person: s.contact_person || '',
        contact_number: s.contact_number || '',
        recom: s.recom || '',
        remarks: s.remarks || '',
        voters_turnout: s.voters_turnout || '',
        additional_note: s.additional_note || '',
        attachments: attachmentsStr,
      });

      // Wrap text for attachments and long fields
      row.getCell('attachments').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('request').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('remarks').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('additional_note').alignment = { wrapText: true, vertical: 'top' };

      // Apply color to Barangay column (column index 3)
      if (s.control_number_color) {
        const mapping = colorMappings.find(m => m.label === s.control_number_color);
        if (mapping && mapping.color) {
          let hexColor = mapping.color.replace('#', '');
          if (hexColor.length === 3) {
            hexColor = hexColor.split('').map(c => c + c).join('');
          }
          if (hexColor.length !== 6) {
            hexColor = 'FFFFFF'; // fallback if invalid hex
          }

          const bgArgb = `FF${hexColor.toUpperCase()}`;
          const cell = row.getCell(3);
          try {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: bgArgb }
            };
            
            // Basic contrast logic
            const r = parseInt(hexColor.substr(0, 2), 16) || 255;
            const g = parseInt(hexColor.substr(2, 2), 16) || 255;
            const b = parseInt(hexColor.substr(4, 2), 16) || 255;
            const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
            const textColor = (yiq >= 128) ? 'FF000000' : 'FFFFFFFF';
            
            cell.font = { color: { argb: textColor } };
          } catch (e) {
            console.warn('Failed to apply color format', mapping.color, e);
          }
        }
      }
    });
  };

  setupSheet('Active', activeSolicitations);
  setupSheet('History Records', historySolicitations);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `solicitations_export_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(blob, filename);
}
