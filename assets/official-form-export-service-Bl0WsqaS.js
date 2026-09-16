const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/xlsx-DaRCrkF7.js","assets/rolldown-runtime-CNC7AqOf.js"])))=>i.map(i=>d[i]);
import{r as e}from"./rolldown-runtime-CNC7AqOf.js";import{n as t}from"./browser-file-download-BvMs0nL2.js";import{t as n}from"./preload-helper-CZgWQFsJ.js";var r=e({WORD_MIME_TYPE:()=>WORD_MIME_TYPE,XLSX_MIME_TYPE:()=>i,exportOfficialTableToExcel:()=>a,printOfficialFormA4:()=>o}),i=`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;async function a({fileName:e,sheetName:r=`Resmî Çizelge`,title:a,subtitle:o,metadata:s=[],columns:c,rows:l,includeSubtotals:u=!1}){let d=await n(()=>import(`./xlsx-DaRCrkF7.js`).then(e=>e.o),__vite__mapDeps([0,1])),f=d.utils.book_new(),p=[];if(p.push([a]),o&&p.push([o]),s.length>0){let e=s.map(e=>`${e.label}: ${e.value}`).join(`  |  `);p.push([e])}p.push([]);let m=p.length;p.push(c.map(e=>e.header));for(let e of l){let t=c.map(t=>{let n=e[t.key];return n==null?``:typeof n==`boolean`?n?`✓`:``:n});p.push(t)}let h=p.length-1;if(u&&l.length>0){let e=c.map((e,t)=>{if(t===0)return`TOPLAM (Görünen / Filtrelenmiş)`;if(e.isNumeric){let e=String.fromCharCode(65+t);return{f:`SUBTOTAL(109, ${e}${m+2}:${e}${h+1})`}}return``});p.push(e)}let g=d.utils.aoa_to_sheet(p);if(g[`!cols`]=c.map(e=>({wch:e.width||Math.max(e.header.length+4,14)})),l.length>0){let e=String.fromCharCode(65+c.length-1);g[`!autofilter`]={ref:`A${m+1}:${e}${h+1}`}}g[`!margins`]={left:.3,right:.3,top:.5,bottom:.5,header:.2,footer:.2},d.utils.book_append_sheet(f,g,r),t({bytes:new Uint8Array(d.write(f,{type:`array`,bookType:`xlsx`,compression:!0})),mimeType:i,fileName:e.endsWith(`.xlsx`)?e:`${e}.xlsx`})}function o(e){if(typeof document>`u`)return;let t=document.querySelector(`.official-sheet, .official-form-container, .a4-printable, [data-printable='true']`);if(!t){let t=document.title;try{document.title=e,window.print()}finally{window.setTimeout(()=>{document.title=t},1500)}return}let n=t.cloneNode(!0),r=t.querySelectorAll(`input, textarea, select`),i=n.querySelectorAll(`input, textarea, select`);r.forEach((e,t)=>{let n=i[t];if(!n)return;let r=``;r=e instanceof HTMLSelectElement&&e.options[e.selectedIndex]?.text||e.value;let a=n.parentElement?.querySelector(`.print-only-text`);if(a)r&&(a.textContent=r),a.style.display=`block`;else{let e=document.createElement(`span`);e.className=`print-only-text`,e.textContent=r,e.style.display=`block`,e.style.whiteSpace=`pre-wrap`,e.style.wordBreak=`break-word`,n.parentElement?.insertBefore(e,n)}}),n.querySelectorAll(`button, select, input, textarea, .official-form-actions, .no-print, .official-workspace-header`).forEach(e=>e.remove());let a=t.classList.contains(`is-landscape`)||t.querySelector(`.is-landscape`)!==null||e.toLowerCase().includes(`ek-15`)||e.toLowerCase().includes(`matris`)||e.toLowerCase().includes(`cizelge`),o=document.createElement(`iframe`);o.setAttribute(`aria-hidden`,`true`),o.setAttribute(`tabindex`,`-1`),o.title=e,Object.assign(o.style,{position:`fixed`,left:`-10000px`,top:`0`,width:a?`297mm`:`210mm`,height:a?`210mm`:`297mm`,border:`0`,opacity:`0`,pointerEvents:`none`,zIndex:`-9999`}),o.srcdoc=`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${e.replace(/[<>&"]/g,``)}</title>
  <style>
    @page {
      size: ${a?`A4 landscape`:`A4 portrait`};
      margin: 8mm 10mm 10mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: ${a?`7.5pt`:`8.5pt`};
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .official-form-modal,
    .official-workspace-overlay,
    .official-workspace-body {
      position: static !important;
      inset: auto !important;
      background: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .official-form-container,
    .official-sheet {
      width: 100% !important;
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      background: #ffffff !important;
    }
    .official-sheet__header,
    .official-form-header {
      text-align: center;
      margin-bottom: 8pt;
      display: block !important;
    }
    .official-sheet__title,
    .official-form-header h1,
    .official-form-header h2 {
      font-size: 13pt !important;
      font-weight: 800 !important;
      color: #173862 !important;
      text-align: center !important;
      margin: 0 0 6pt 0 !important;
      letter-spacing: 0.5px !important;
      display: block !important;
    }
    .official-sheet__guidance {
      background: #fafafa !important;
      border-left: 2.5pt solid #555 !important;
      padding: 4pt 8pt !important;
      font-size: 8pt !important;
      color: #222 !important;
      margin-bottom: 6pt !important;
      display: block !important;
    }
    table, table.official-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 6pt !important;
      border: 1.5pt solid #173862 !important;
      page-break-inside: auto;
      break-inside: auto;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td, .official-table th, .official-table td {
      border: 1pt solid #475569 !important;
      padding: 4pt 6pt !important;
      font-size: ${a?`7.5pt`:`8.5pt`} !important;
      line-height: 1.25 !important;
      vertical-align: top !important;
      color: #000000 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .official-table__section-header {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 700 !important;
      font-size: 9pt !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .official-table__label {
      background-color: #f8fafc !important;
      font-weight: 600 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print, .official-form-actions, .of-input, .of-textarea, .no-print-select, button {
      display: none !important;
    }
    .print-only-text {
      display: block !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
      color: #000000 !important;
      font-size: ${a?`7.5pt`:`8.5pt`} !important;
    }
    .official-sheet__footer,
    .official-form-footer {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-end !important;
      margin-top: 8pt !important;
      padding-top: 4pt !important;
      border-top: 1pt solid #cbd5e1 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .signature-line {
      margin-top: 6pt !important;
      color: #334155 !important;
    }
    .official-sheet__page-num {
      font-weight: 800 !important;
      color: #173862 !important;
    }
  </style>
</head>
<body>
  ${n.outerHTML}
</body>
</html>`;let s=!1,c=()=>{if(!s){s=!0;try{o.contentWindow?.focus(),o.contentWindow?.print()}catch{window.print()}finally{window.setTimeout(()=>{o.remove()},5e3)}}};o.onload=()=>{window.setTimeout(c,250)},document.body.appendChild(o),window.setTimeout(()=>{s||c()},1e3)}export{o as i,a as n,r,i as t};