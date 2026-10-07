/**
 * CKEditor 5 custom build — GPL-3.0-or-later (lihat LICENSE).
 * Build:  npm run build:editor  →  frontend/vendor/ckeditor5/ckeditor.js + ckeditor.css
 *
 * Catatan: build sendiri (bukan build resmi siap pakai) karena build resmi
 * tidak punya Alignment/Font/Underline dan tidak menyertakan plugin RawStyle.
 */
import {
    ClassicEditor as ClassicEditorBase,
    Essentials, Paragraph, Heading,
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
    Alignment, FontFamily, FontSize, FontColor, FontBackgroundColor,
    List, Link, BlockQuote, Indent, IndentBlock,
    HorizontalLine, RemoveFormat, SelectAll,
    Table, TableToolbar, PasteFromOffice,
    Plugin, ButtonView
} from 'ckeditor5';
import 'ckeditor5/ckeditor5-editor.css';
import 'ckeditor5/ckeditor5-content.css';
import RawStyle from './rawstyle.js';

/**
 * Tombol "Tanpa Border" — sembunyikan/kembalikan border SELURUH tabel satu klik.
 * Menyentuh atribut model `style` (milik RawStyle) supaya selamat di data, editing view, dan cetak.
 * ponytail: cukup untuk kebutuhan "hilangkan border tabel"; dialog TableProperties/CellProperties kalau perlu kontrol warna/lebar.
 */
class TableBorderToggle extends Plugin {
    static get pluginName() { return 'TableBorderToggle'; }

    init() {
        const editor = this.editor;
        const findTable = () => {
            const sel = editor.model.document.selection;
            const el = sel.getSelectedElement();
            if (el && el.is && el.is('element', 'table')) return el;
            const pos = sel.getFirstPosition();
            return pos && pos.findAncestor('table');
        };
        const allCells = table => {
            const out = [];
            (function walk(n) {
                for (const c of n.getChildren()) {
                    if (!c.is || !c.is('element')) continue;
                    if (c.is('element', 'tableCell')) out.push(c);
                    else walk(c);
                }
            })(table);
            return out;
        };
        // strip prop border (garis) saja — border-collapse/border-spacing/border-radius dipertahankan
        const isBorderLine = decl => {
            const prop = (decl.slice(0, decl.indexOf(':')) || '').trim().toLowerCase();
            return /^border(-(top|right|bottom|left))?(-(color|style|width))?$/.test(prop);
        };
        const stripBorder = style => (style || '').split(';')
            .map(s => s.trim()).filter(s => s && s.includes(':') && !isBorderLine(s));

        editor.ui.componentFactory.add('toggleTableBorder', locale => {
            const btn = new ButtonView(locale);
            btn.set({ label: 'Tanpa Border', tooltip: true, withText: true, isOn: false });
            btn.on('execute', () => {
                const table = findTable();
                if (!table) return;
                const hide = !btn.isOn;
                editor.model.change(writer => {
                    for (const el of [table, ...allCells(table)]) {
                        let style = stripBorder(el.getAttribute('style'));
                        if (hide) style.push('border:none');
                        else if (el.is('element', 'tableCell')) {
                            style.push('border:1px solid #000');
                            if (!style.some(s => /^padding\s*:/i.test(s))) style.push('padding:6px');
                        }
                        if (style.length) writer.setAttribute('style', style.join(';'), el);
                        else writer.removeAttribute('style', el);
                    }
                });
            });
            const refresh = () => {
                const table = findTable();
                btn.isEnabled = !!table;
                btn.isOn = !!table && /(^|;)\s*border\s*:\s*none/i.test(table.getAttribute('style') || '');
            };
            editor.model.document.on('change:selection', refresh);
            editor.model.document.on('change', refresh);
            refresh();
            return btn;
        });
    }
}

class ClassicEditor extends ClassicEditorBase {}

ClassicEditor.builtinPlugins = [
    Essentials, Paragraph, Heading,
    Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
    Alignment, FontFamily, FontSize, FontColor, FontBackgroundColor,
    List, Link, BlockQuote, Indent, IndentBlock,
    HorizontalLine, RemoveFormat, SelectAll,
    Table, TableToolbar, PasteFromOffice,
    TableBorderToggle,
    RawStyle
];

ClassicEditor.defaultConfig = {
    toolbar: [
        'heading', '|',
        'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', '|',
        'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
        'alignment', '|',
        'bulletedList', 'numberedList', '|',
        'outdent', 'indent', '|',
        'link', 'blockQuote', 'horizontalLine', '|',
        'insertTable', 'removeFormat', '|',
        'undo', 'redo'
    ],
    heading: {
        options: [
            { model: 'paragraph', view: 'p', title: 'Normal', class: 'ck-heading_paragraph' },
            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
            { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' }
        ]
    },
    fontFamily: {
        options: ['default', 'Aptos', 'Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Tahoma', 'Verdana']
    },
    fontSize: {
        options: ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '28pt'],
        supportAllValues: true
    },
    table: {
        contentToolbar: ['toggleTableBorder', 'tableColumn', 'tableRow', 'mergeTableCells']
    }
};

window.ClassicEditor = ClassicEditor;
