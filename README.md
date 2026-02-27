# ⚡ Guía Emmet — Notas de estudio

> Material personal. Explica cómo está construida esta guía por dentro: la estructura HTML, los patrones CSS y toda la lógica JavaScript, incluyendo el parser de Emmet que escribí desde cero.

---

## Estructura del proyecto

```
emmet-guide/
├── index.html   → estructura y contenido (solo HTML semántico)
├── styles.css   → todo el diseño (variables, layout, responsive)
└── script.js    → toda la lógica (tabs, copiar, playground, parser)
```

La separación es intencional: HTML no tiene ni una línea de estilo inline, CSS no tiene JavaScript, JS no inyecta estilos. Esto hace el código fácil de mantener.

---

## index.html — Cómo está estructurado

### El patrón de tabs sin JavaScript visible en el HTML

Cada botón del menú tiene un atributo `data-section` que apunta al `id` de la sección correspondiente:

```html
<button class="tab active" data-section="html-base">HTML Base</button>
<!-- ... -->
<section class="section active" id="html-base">...</section>
```

El HTML no sabe nada de cómo funciona la navegación. Solo declara la relación entre botón y sección a través del atributo `data-*`. El JS lee ese atributo y hace el resto. **Esto es separación de responsabilidades.**

### El patrón de copia: `data-copy`

Cada snippet que se puede copiar tiene su valor directamente en el HTML como atributo:

```html
<div class="snippet" data-copy="nav>ul>li">
  <code class="snippet__abbr">nav>ul>li</code>
  ...
</div>
```

El JS simplemente lee `el.dataset.copy` al hacer clic. No necesita buscar el texto dentro del elemento ni hacer parsing del DOM. El dato viaja en el atributo.

### BEM — la convención de nombres CSS

Las clases siguen la metodología **BEM (Block Element Modifier)**:

```
.card          → Bloque (componente independiente)
.card__title   → Elemento (parte del bloque, separado con __)
.card--highlight → Modificador (variante del bloque, separado con --)
```

¿Por qué sirve? Porque puedo leer `.card__title` en cualquier parte del código y saber inmediatamente que es el título *dentro* de una card. Sin BEM, la clase se llamaría solo `.title` y no sabría a qué pertenece.

---

## styles.css — Cómo está diseñado

### Variables CSS (Custom Properties)

Todo el diseño parte de variables definidas en `:root`:

```css
:root {
  --bg:      #0e0f11;
  --accent:  #d4f54a;
  --blue:    #4ac8f5;
  --text:    #e2e4e8;
  --muted:   #7a7d86;
  --border:  #2a2c30;
  /* ... */
}
```

**Por qué es importante:** Si quiero cambiar el color de acento de amarillo-verde a naranja, cambio una sola línea y se actualiza en toda la UI. Sin variables tendría que buscar y reemplazar el mismo valor hexadecimal en decenas de lugares.

### Sistema de color intencional

El esquema tiene 3 capas de contraste:

| Variable | Uso |
|---|---|
| `--text` | Texto principal, legible |
| `--muted` | Texto secundario, descripciones |
| `--muted2` | Texto terciario, casi invisible |
| `--accent` | Amarillo-verde: interacciones, énfasis |
| `--blue` | Azul: output/resultado (output siempre en azul) |

El color azul para el output no es capricho estético — es semántico. Verde/amarillo = lo que escribo yo, azul = lo que genera la máquina. El ojo aprende a distinguirlos.

### Layout con CSS Grid auto-fill

```css
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
```

`auto-fill` + `minmax(300px, 1fr)` es un patrón muy poderoso:
- En pantalla grande: crea tantas columnas como quepan de mínimo 300px
- En tablet: 2 columnas
- En móvil: 1 columna
- **Sin una sola media query para el grid**

### Responsive strategy — mobile-first con 3 breakpoints

```css
/* Base: estilos para móvil */
.tab { padding: 10px 12px; }

/* Tablet y arriba */
@media (min-width: 768px) { ... }

/* Solo para pantallas muy pequeñas */
@media (max-width: 480px) {
  /* Los snippets dejan de ser grid y se apilan */
  .snippet { grid-template-columns: 1fr; }
  .snippet__arrow { display: none; }
}
```

En 480px los snippets colapsan: la flecha `→` desaparece y el output queda debajo del abbr con un borde izquierdo como indicador visual.

### El truco del sticky header

```css
.header {
  position: sticky;
  top: 0;
  z-index: 50;
}
```

`sticky` es diferente a `fixed`. Un elemento `fixed` sale del flujo del documento y el contenido queda debajo de él (hay que añadir padding al body). Un elemento `sticky` se queda en su lugar hasta que el scroll lo alcanza, y *entonces* se adhiere. No rompe el flujo.

### Transiciones CSS — solo las propiedades necesarias

```css
.tab {
  transition: color 0.15s, border-color 0.15s;
}
```

Nunca `transition: all` en producción. Anima solo las propiedades que realmente cambian. `all` puede causar animaciones inesperadas y es más costoso para el navegador.

### El toast (notificación flotante)

```css
.toast {
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none; /* ← no bloquea clics cuando es invisible */
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}
```

El toast existe en el DOM todo el tiempo, pero es invisible (`opacity: 0`). Cuando el JS añade la clase `.show`, la transición CSS hace el trabajo de animarlo. El JS solo toggle una clase — no anima nada directamente.

`pointer-events: none` es clave: sin eso, el toast invisible bloquearía los clics en los elementos debajo de él.

---

## script.js — Cómo funciona la lógica

### IIFE — por qué todo está envuelto así

```js
(function () {
  'use strict';
  // todo el código aquí
}());
```

**IIFE = Immediately Invoked Function Expression.** Es una función que se ejecuta sola, inmediatamente. Sirve para crear un *scope* privado: ninguna de las variables o funciones internas (como `copyText`, `expandEmmet`, etc.) se "filtran" al scope global (`window`). Esto evita conflictos con otras librerías o scripts en la página.

`'use strict'` activa el modo estricto de JS: lanza errores donde JS normalmente falla silenciosamente (variables no declaradas, `this` en contextos raros, etc.).

### initTabs — navegación entre secciones

```js
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const targetId = tab.dataset.section;  // lee el data-section del HTML
      activateSection(targetId);
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      tab.scrollIntoView({ inline: 'nearest', behavior: 'smooth' }); // para móvil
    });
  });
}
```

`tab.scrollIntoView({ inline: 'nearest' })` es el detalle que hace que en móvil, al cambiar de tab, el botón activo siempre sea visible aunque el nav haga scroll horizontal. Sin esto, podrías activar una tab que está fuera de la pantalla y el usuario no vería el botón activo.

### updateProgress — la barra de progreso

```js
function updateProgress(activeId) {
  var idx = SECTIONS_ORDER.indexOf(activeId);
  var pct = ((idx + 1) / SECTIONS_ORDER.length) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
}
```

`SECTIONS_ORDER` es un array con el orden de las secciones. `indexOf` devuelve la posición (0-based), sumamos 1 para que la primera sección muestre algo (no 0%), y dividimos entre el total para obtener el porcentaje. Simple aritmética.

### copyText — copiar al portapapeles con fallback

```js
function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(function () { showToast('¡Copiado!'); })
    .catch(function () {
      // Fallback para navegadores viejos
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('¡Copiado!');
    });
}
```

`navigator.clipboard.writeText()` es la API moderna para copiar. Es asíncrona (devuelve una Promise) y requiere que la página esté en HTTPS o localhost. El `.catch()` maneja el caso donde falla (HTTP, browsers viejos): crea un `textarea` invisible, selecciona su texto, ejecuta el comando `copy` del navegador (API vieja pero funciona en todos lados), y lo elimina. El usuario nunca ve nada.

### showToast — la notificación

```js
var toastTimer = null;

function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);                    // cancela el timer anterior
  toastTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2000);
}
```

`clearTimeout` antes de `setTimeout` es importante: si el usuario hace clic varias veces rápido, sin el `clear` se acumularían timers y el toast desaparecería antes de tiempo. Con el `clear`, cada clic reinicia el contador de 2 segundos.

---

## El Parser de Emmet — la parte más interesante

El playground tiene un parser propio que interpreta abreviaturas Emmet y genera HTML. No es el parser real de Emmet (que es una librería completa), pero cubre los casos más útiles.

### Flujo general

```
abbr (string)
  → preprocessAbbr()     normaliza atajos especiales
  → expandEmmet()        maneja casos especiales (!, lorem)
  → parseExpression()    parsea la expresión completa
    → parseNode()        parsea un elemento individual
      → parseTagInfo()   extrae tag, clases, id, attrs, texto, multiplicador
      → buildElement()   genera el HTML del elemento
```

### preprocessAbbr — normalización previa

```js
function preprocessAbbr(abbr) {
  abbr = abbr.replace(/\b(input|select|textarea|button):([\w-]+)/g,
    function (_, tag, type) {
      return 'input[type=' + type + ']';
    }
  );
  abbr = abbr.replace(/\blink:css\b/g, 'link[rel=stylesheet href=style.css]');
  abbr = abbr.replace(/\bbtn\b/g, 'button');
  return abbr;
}
```

Antes de parsear, convierto los atajos especiales a su forma canónica. `input:email` se convierte en `input[type=email]`, que el parser principal sabe manejar como un atributo normal. Esto simplifica el parser: no necesita casos especiales para `input:*`.

### parseTagInfo — el corazón del parser

Esta función lee un string caracter por caracter y va extrayendo las partes de un elemento:

```js
function parseTagInfo(str) {
  var tag = '', classes = [], id = '', attrs = '', text = '', mul = 1;
  var i = 0;

  // 1. Lee el nombre del tag (letras y números)
  while (i < str.length && /[a-zA-Z0-9_-]/.test(str[i])) {
    tag += str[i++];
  }
  if (!tag) tag = 'div'; // sin tag → div por defecto

  // 2. Lee los modificadores en loop
  while (i < str.length) {
    var c = str[i];

    if (c === '.') { /* extrae clase */ }
    if (c === '#') { /* extrae id */ }
    if (c === '[') { /* extrae atributos hasta ] */ }
    if (c === '{') { /* extrae texto hasta } */ }
    if (c === '*') { /* extrae número de repeticiones */ }
    else break;      // cualquier otro char → stop (es operador: >, +, ^)
  }

  return { tag, classes, id, attrs, text, mul, rest: str.slice(i) };
  //                                              ↑ lo que queda sin parsear
}
```

El truco clave es `rest`: la función devuelve no solo lo que encontró, sino también **el string que no consumió**. Así el parser principal sabe dónde continuar. Este patrón se llama *parser combinador*.

Por ejemplo, con `div.card>h2+p`:
- `parseTagInfo` consume `div.card` y devuelve `rest = ">h2+p"`
- El parser principal ve el `>`, sabe que viene un hijo
- Llama a `parseTagInfo` con `h2+p`, consume `h2`, devuelve `rest = "+p"`
- Ve el `+`, sabe que viene un hermano
- Y así sucesivamente

### parseExpression vs parseNode — dos niveles

```
parseExpression: maneja secuencias de hermanos (A + B + C)
  └→ llama a parseNode para cada uno

parseNode: maneja un elemento y sus hijos (A > B > C)
  └→ llama a parseTagInfo para el elemento
  └→ llama a parseExpression para los hijos (recursión)
```

La recursión mutual entre `parseExpression` y `parseNode` es lo que permite parsear estructuras arbitrariamente profundas como `nav>ul>li*3>a>span`.

### buildElement — generar el HTML

```js
function buildElement(node, depth) {
  var results = [];
  for (var i = 1; i <= node.mul; i++) {         // repite mul veces
    var classes = substituteCounter(node.classes.join(' '), i, mul);  // item$ → item1

    if (VOID_TAGS.has(tag)) {
      results.push('<' + tag + attrStr + '>');   // sin cierre: <input>, <img>
      continue;
    }

    var inner = childHtml
      ? '\n' + indent(childHtml, 1) + '\n'       // hijos con indentación
      : textStr;                                  // o texto plano

    results.push(open + inner + close);
  }
  return results.join('\n');
}
```

`VOID_TAGS` es un `Set` con los tags HTML que no tienen cierre (`<img>`, `<input>`, `<br>`, etc.). Usar `Set` en vez de un array es más eficiente para la búsqueda: `Set.has()` es O(1), `Array.includes()` es O(n). Para un parser que se ejecuta con cada tecla que pulsa el usuario, esto importa.

### substituteCounter — el operador `$`

```js
function substituteCounter(str, i, total) {
  str = str.replace(/\$\$/g, String(i).padStart(2, '0')); // $$ → 01, 02
  str = str.replace(/\$/g, String(i));                     // $  → 1, 2
  return str;
}
```

El orden importa: primero reemplaza `$$` (dos signos), luego `$` (uno). Si lo hiciera al revés, `$$` se convertiría primero en `1$` (reemplazando el primer `$`) y luego el `$` restante se convertiría en `11` — incorrecto.

---

## Patrones que aprendí construyendo esto

**`data-*` para conectar HTML y JS** — los atributos custom evitan que el JS tenga que "adivinar" cosas del DOM. El HTML le dice al JS exactamente qué hacer.

**Separar estado de presentación** — el estado (qué sección está activa) vive como una clase CSS (`.active`). El JS solo añade/quita clases. Los estilos controlan la visibilidad. Cada uno hace su trabajo.

**Fallbacks para APIs modernas** — `clipboard.writeText` es moderno pero puede fallar. Siempre que use una API con `Promise`, tener un `.catch()` con la alternativa vieja.

**Parser con `rest`** — cuando parseas un string caracter por caracter, siempre devuelve lo que no consumiste. Así puedes encadenar funciones de parsing sin coordinar índices globales.

**`clearTimeout` antes de `setTimeout`** — si una función puede llamarse múltiples veces rápido y tiene un timer, siempre cancelar el anterior antes de crear uno nuevo.

---

## Cómo extender este proyecto

Algunas ideas si quisiera seguir practicando:

- **Añadir una sección nueva**: crear el `<section id="nueva">` en el HTML, añadir el botón en el nav con `data-section="nueva"`, y añadir `"nueva"` al array `SECTIONS_ORDER` en el JS.
- **Añadir modo claro**: las variables CSS hacen esto trivial — con un media query `prefers-color-scheme: light` bastaría con redefinir las variables en `:root`.
- **Mejorar el parser**: soportar `^^` (subir dos niveles), o el operador `@-` para contar hacia atrás, o `lorem` dentro de textos como `p>{lorem5}`.
- **Persistencia**: guardar la última sección visitada con `localStorage.setItem('lastSection', id)` y restaurarla al cargar.