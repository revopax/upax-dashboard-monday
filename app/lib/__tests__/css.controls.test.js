import { describe, it, expect } from 'vitest';
import { CSS } from '../css.js';
import fs from 'fs';
import path from 'path';

describe('Controles: mismo lenguaje visual para select, PersonSelect y DateField', () => {
  it('la base cubre a los tres en la misma regla', () => {
    expect(CSS).toContain('select,.ctl-btn{');
  });

  it('quita la apariencia nativa para poder dibujar la propia', () => {
    expect(CSS).toContain('-webkit-appearance:none;appearance:none');
    // La regla vieja forzaba el look del sistema y ganaba sobre cualquier estilo.
    expect(CSS).not.toContain('select{-webkit-appearance:auto}');
  });

  it('hover sube el borde de --bg4 a --border', () => {
    expect(CSS).toContain('select:hover,.ctl-btn:hover:not(:disabled){border-color:var(--border)');
  });

  it('el foco usa anillo azul en vez del outline suelto', () => {
    expect(CSS).toContain('box-shadow:0 0 0 3px rgba(0,122,255,.16)');
  });

  // Sin el :not(:disabled) la regla empata en especificidad con
  // `select:focus-visible{outline:2px solid var(--blue)}`, que va después en la
  // hoja y ganaría: el select saldría con outline Y anillo a la vez.
  it('el foco del select le gana en especificidad al outline genérico', () => {
    const mine = CSS.indexOf('select:focus-visible:not(:disabled)');
    const generic = CSS.indexOf('select:focus-visible{outline:2px solid var(--blue)');
    expect(mine).toBeGreaterThan(-1);
    expect(generic).toBeGreaterThan(-1);
    expect(generic).toBeGreaterThan(mine); // la genérica va después: hace falta la especificidad
  });

  it('mantiene intacto el foco accesible genérico del resto de controles', () => {
    expect(CSS).toContain('button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}');
    expect(CSS).toContain('textarea:focus-visible{outline:2px solid var(--blue);outline-offset:2px}');
  });

  it('marca el control como activo mientras su panel está abierto', () => {
    expect(CSS).toContain('.ctl-btn[aria-expanded="true"]');
  });

  it('gira el chevron al abrir', () => {
    expect(CSS).toContain('.ctl-btn[aria-expanded="true"] .ctl-chevron{transform:rotate(180deg)}');
  });
});

describe('Select', () => {
  it('dibuja su propio chevron y le deja lugar a la derecha', () => {
    expect(CSS).toContain('padding-right:26px');
    expect(CSS).toContain('background-position:right 7px center');
  });

  it('oscurece el chevron en hover y foco', () => {
    expect(CSS).toContain('select:hover,select:focus{');
    expect(CSS).toContain('%231D1D1F'); // --tx, el chevron activo
  });
});

describe('Calendario de DateField', () => {
  it('tiene estados de hover para navegación, días y acciones', () => {
    expect(CSS).toContain('.cal-nav:hover{background:var(--bg3)');
    expect(CSS).toContain('.cal-action:hover{background:var(--bg3)}');
  });

  // El día elegido se pinta azul con estilo inline; sin el :not() el hover lo
  // tapaba con gris y parecía que se deseleccionaba al pasar el mouse.
  it('el hover de día no pisa al día seleccionado', () => {
    expect(CSS).toContain('.cal-day:hover:not([aria-pressed="true"])');
  });
});

// Un style inline gana siempre sobre la hoja, así que un borde o un radio dejado
// en el componente vuelve a romper la consistencia sin que nada avise.
describe('los componentes no reponen estilos que ahora vienen del design system', () => {
  const read = (rel) => fs.readFileSync(path.join(process.cwd(), 'app/components', rel), 'utf8');
  const conSelect = ['AuditLogPanel.jsx', 'home/GddTrendSection.jsx'];

  for (const f of conSelect) {
    it(`${f} deja el select sin borde/fondo/radio inline`, () => {
      const src = read(f);
      const lineas = src.split('\n').filter((l) => l.includes('<select'));
      expect(lineas.length).toBeGreaterThan(0);
      for (const l of lineas) {
        expect(l).not.toMatch(/border(Radius)?:/);
        expect(l).not.toMatch(/background:/);
      }
    });
  }

  // El nativo no se puede estilizar: si vuelve a aparecer uno, el calendario feo
  // vuelve con él.
  it('no queda ningún input[type=date] nativo en la app', () => {
    const dir = path.join(process.cwd(), 'app');
    const archivos = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); }
        else if (/\.jsx?$/.test(e.name)) archivos.push(full);
      }
    };
    walk(dir);
    const culpables = archivos.filter((f) => {
      // Sin líneas de comentario: DateField.jsx menciona el nativo justo para
      // explicar por qué lo reemplaza.
      const codigo = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
      return codigo.some((l) => /<input[^>]*type="date"/.test(l));
    });
    expect(culpables).toEqual([]);
  });
});
