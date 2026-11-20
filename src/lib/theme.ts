/** Tema de la interfaz: claro, oscuro o el del sistema operativo. Se guarda en una cookie (por navegador). */
export type Theme = "light" | "dark" | "system";
export const THEMES: Theme[] = ["light", "dark", "system"];
export const THEME_COOKIE = "kurier_theme";
export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system";

/**
 * Script que corre antes de pintar (en <head>): aplica la clase `dark` según la cookie y,
 * con "system", según la preferencia del sistema (y la sigue si cambia). Evita el destello claro.
 */
export const THEME_SCRIPT = `(()=>{try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var t=m?m[1]:"light";var q=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var d=t==="dark"||(t==="system"&&q.matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";};a();if(t==="system")q.addEventListener("change",a);}catch(e){}})();`;

/**
 * Con la pestaña oculta el navegador rechaza las View Transitions (InvalidStateError) y React deja el error sin atrapar.
 * Si la pestaña está oculta, el cambio se aplica directo, sin animación (nadie la vería). Se instala antes de React.
 */
export const VIEW_TRANSITION_GUARD = `(()=>{var d=document,s=d.startViewTransition;if(!s)return;d.startViewTransition=function(a){if(d.visibilityState!=="hidden")return s.call(d,a);var cb=typeof a==="function"?a:a&&a.update;var done=Promise.resolve().then(function(){return cb&&cb()});return{ready:done.then(function(){}),finished:done.then(function(){}),updateCallbackDone:done.then(function(){}),skipTransition:function(){},types:new Set()};};})();`;
