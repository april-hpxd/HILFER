import { escapeHTML as h } from './shared.js';

// Reports application. Visual pattern follows Reconciliation (app-toolbar, list/detail
// layout) — see docs/INTEGRATION.md "Reports application". Static repository data; original
// supplied files are rendered as-is (no OCR, rewriting or synthesized metadata).
export const REPORT_ITEMS = [
  { id: 'REPORT-001', title: 'Spacco', format: 'image', src: 'assets/reports/3 (1).png' },
  { id: 'REPORT-002', title: 'Tim', format: 'image', src: 'assets/reports/4 (1).png' }
];

export function mountReports(root) {
  if (!root) return;
  let selectedId = REPORT_ITEMS[0]?.id ?? null;

  function render() {
    const item = REPORT_ITEMS.find(r => r.id === selectedId);
    root.innerHTML =
      '<div class="app-toolbar"><span>Reports</span></div>' +
      '<div class="reconciliation-layout">' +
      '<nav class="case-list" aria-label="Report list"><div class="pane-label">AVAILABLE REPORTS</div>' +
      REPORT_ITEMS.map(r => '<button type="button" data-select-report="' + h(r.id) + '" aria-pressed="' + (r.id === selectedId) + '"><b>' + h(r.title) + '</b><small>' + h(r.id) + '</small></button>').join('') +
      '</nav>' +
      '<div class="case-detail report-viewer">' +
      (item ? renderViewer(item) : '<p>Select a report from the list to view it.</p>') +
      '</div></div>';

    root.querySelectorAll('[data-select-report]').forEach(btn => btn.addEventListener('click', () => {
      selectedId = btn.dataset.selectReport;
      render();
    }));
  }

  function renderViewer(item) {
    const header = '<h1>' + h(item.title) + '</h1><p class="report-id">' + h(item.id) + '</p>';
    if (item.format === 'image') {
      return header + '<div class="report-scroll"><img class="report-image" src="' + h(item.src) + '" alt="Employee report for ' + h(item.title) + '"></div>';
    }
    if (item.format === 'text') {
      return header + '<pre class="report-text"></pre>';
    }
    return header + '<p>This report format is not yet supported for in-app viewing.</p>';
  }

  render();
}
