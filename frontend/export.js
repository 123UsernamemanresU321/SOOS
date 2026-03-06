/* ============================================================
   SESSION ORDER OS — Export / Import System
   ============================================================ */

const Export = (() => {

    /** Export all data as a JSON file download */
    async function downloadJSON() {
        const data = await DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-order-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        App.showToast('Data exported successfully');
    }

    /** Import data from a JSON file */
    function importJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const validation = Validate.validateImportData(data);

                if (!validation.valid) {
                    App.showToast('Invalid import file: ' + validation.errors.join(', '), 'error');
                    return;
                }

                await DB.importAll(data);
                App.showToast('Data imported successfully');
                // Refresh current view
                App.navigate(App.currentPage());
            } catch (err) {
                App.showToast('Import failed: ' + err.message, 'error');
            }
        };
        input.click();
    }

    /** Export incidents report as CSV */
    async function downloadCSV() {
        const incidents = await Incidents.getAll();
        if (incidents.length === 0) {
            App.showToast('No incidents to export');
            return;
        }

        const headers = ['ID', 'Student', 'Category', 'Severity', 'Description', 'Status', 'Timestamp', 'Applied Action'];
        const rows = incidents.map(i => [
            i.id,
            i.studentName || '',
            i.category,
            i.severity,
            `"${(i.description || '').replace(/"/g, '""')}"`,
            i.status,
            i.timestamp,
            i.appliedAction?.action || ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `incidents-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        App.showToast('CSV report exported');
    }

    return { downloadJSON, importJSON, downloadCSV };
})();
