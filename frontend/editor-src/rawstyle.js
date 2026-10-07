/**
 * RawStyle — plugin CKEditor 5: lewatkan atribut `style` HTML mentah.
 *
 * Pipeline CKEditor membuang style tak digenal (text-transform, text-decoration,
 * margin, line-height, border tabel, dll) — padahal template surat & export docx
 * bergantung padanya. Plugin ini menyimpan style sebagai satu atribut model
 * 'style' dan menuliskannya kembali ke data & editing view.
 *
 * 'text-align' dikecualikan HANYA untuk elemen yang didukung plugin Alignment
 * (paragraf/heading, via atribut model 'alignment'); td/table/div dll menyimpan
 * text-align sendiri di atribut style supaya sinkron editor ↔ preview.
 */
const EXCLUDE_PROPS = ['text-align'];

const filterStyle = (styleStr) =>
    styleStr.split(';').map(s => s.trim())
        .filter(d => d && !EXCLUDE_PROPS.some(p => d.toLowerCase().startsWith(p + ':')))
        .join(';');

const cssToObj = (styleStr) => {
    const o = {};
    styleStr.split(';').forEach(d => {
        const i = d.indexOf(':');
        if (i > 0) o[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    });
    return o;
};

class RawStyle {
    static get pluginName() { return 'RawStyle'; }

    constructor(editor) { this._editor = editor; }

    init(e) {
        const editor = e || this._editor;
        const schema = editor.model.schema;
        const names = [];
        for (const name of Object.keys(schema.getDefinitions())) {
            if (name.startsWith('$')) continue;
            names.push(name);
            try { schema.extend(name, { allowAttributes: 'style' }); } catch (_) {}
        }

        // view → model: simpan style mentah; text-align hanya dikecualikan utk elemen
        // yang didukung Alignment (p/heading) — td/table/div dkk tetap simpan text-align
        // miliknya supaya editor ↔ preview/cetak sinkron.
        editor.conversion.for('upcast').add(dispatcher => {
            dispatcher.on('element', (evt, data, conversionApi) => {
                if (!data.modelRange) return;
                const v = data.viewItem;
                if (!v || !v.is || !v.is('element')) return;
                const n = data.modelRange.start.nodeAfter;
                if (!n || !n.is || !n.is('element')) return;
                let style = v.getAttribute('style') || '';
                if (!style) return;
                if (schema.checkAttribute(n, 'alignment')) style = filterStyle(style);
                if (!style) return;
                conversionApi.writer.setAttribute('style', style, n);
            }, { priority: 'low' });
        });

        // model → view: tulis style kembali (data & editing view)
        // <table> didowncast jadi <figure class="table">; style harus di <table>-nya
        const targetViewEl = (item, conversionApi) => {
            let viewEl = conversionApi.mapper.toViewElement(item);
            if (!viewEl) return null;
            if (item.is('element', 'table') && viewEl.is('element', 'figure')) {
                const inner = Array.from(viewEl.getChildren()).find(c => c.is && c.is('element', 'table'));
                if (inner) viewEl = inner;
            }
            return viewEl;
        };
        const applyDown = (evt, data, conversionApi) => {
            const item = data.item;
            if (!item || !item.is || !item.is('element')) return;
            const style = item.getAttribute('style');
            if (!style) return;
            const viewEl = targetViewEl(item, conversionApi);
            if (!viewEl) return;
            conversionApi.writer.setStyle(cssToObj(style), viewEl);
        };
        const applyAttr = (evt, data, conversionApi) => {
            const el = data.item;
            if (!el || !el.is || !el.is('element')) return;
            const viewEl = targetViewEl(el, conversionApi);
            if (!viewEl) return;
            const style = el.getAttribute('style');
            if (style) conversionApi.writer.setStyle(cssToObj(style), viewEl);
            else {
                // CKEditor v48 tidak punya getStyles() — ambil key dari penyimpanan internal view;
                // text-align dibiarkan utk elemen milik Alignment (p/heading), ikut dihapus utk td/dkk
                const keepAlign = schema.checkAttribute(el, 'alignment');
                const keys = (viewEl._styles && typeof viewEl._styles.keys === 'function')
                    ? viewEl._styles.keys().filter(k => k !== 'text-align' || !keepAlign) : [];
                for (const k of keys) conversionApi.writer.removeStyle(k, viewEl);
            }
        };
        for (const conv of ['dataDowncast', 'editingDowncast']) {
            editor.conversion.for(conv).add(d => {
                for (const name of names) {
                    d.on('insert:' + name, applyDown, { priority: 'low' });
                    d.on('attribute:style:' + name, applyAttr, { priority: 'low' });
                }
            });
        }
    }
}

export default RawStyle;
