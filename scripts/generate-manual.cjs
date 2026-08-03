/* Genera el manual de usuario de BioCasa en PDF */
const PDFDocument = require("pdfkit");
const fs = require("fs");

const out = "attached_assets/Manual-BioCasa.pdf";
const doc = new PDFDocument({ size: "LETTER", margins: { top: 60, bottom: 60, left: 60, right: 60 } });
doc.pipe(fs.createWriteStream(out));

const GREEN = "#2f7d32";
const DARK = "#222";

function title(t) { doc.moveDown(0.8).fontSize(17).fillColor(GREEN).font("Helvetica-Bold").text(t); doc.moveDown(0.3); }
function sub(t) { doc.moveDown(0.5).fontSize(13).fillColor(DARK).font("Helvetica-Bold").text(t); doc.moveDown(0.15); }
function p(t) { doc.fontSize(10.5).fillColor(DARK).font("Helvetica").text(t, { lineGap: 2.5 }); }
function li(items) { doc.fontSize(10.5).fillColor(DARK).font("Helvetica").list(items, { bulletRadius: 1.8, lineGap: 2.5, textIndent: 14 }); }

// Portada
doc.fontSize(30).fillColor(GREEN).font("Helvetica-Bold").text("BioCasa", { align: "center" });
doc.moveDown(0.2).fontSize(14).fillColor(DARK).font("Helvetica").text("Diseño en Guadua y Tierra", { align: "center" });
doc.moveDown(1.5).fontSize(20).font("Helvetica-Bold").text("Manual de Usuario", { align: "center" });
doc.moveDown(0.3).fontSize(11).font("Helvetica").text("Cómo diseñar tu casa de bioconstrucción paso a paso", { align: "center" });
doc.moveDown(0.5).fontSize(10).fillColor("#666").text(new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }), { align: "center" });

doc.addPage();

title("1. ¿Qué es BioCasa?");
p("BioCasa es tu taller de diseño de casas en bioconstrucción (bahareque, tapia pisada, adobe, guadua). Con ella puedes: dibujar los planos de la casa, recorrerla en 3D, marcar las instalaciones eléctricas y de agua, calcular materiales con precios en pesos colombianos, y generar planos técnicos estilo arquitecto listos para imprimir.");

title("2. El Panel principal");
li([
  "Al abrir la app ves la lista de tus proyectos (cada casa es un proyecto).",
  "Botón para crear un proyecto nuevo: le pones nombre, ubicación, sistema de muros y tipo de cubierta.",
  "Toca cualquier proyecto para entrar a trabajarlo.",
  "También está el Catálogo de Materiales con los precios que usa la cotización.",
]);

title("3. Diseñar el plano (pestaña Diseño de Planos)");
sub("3.1 Agregar espacios");
li([
  "Botón «+ Agregar» (Lista de Espacios): creas un espacio con nombre, tipo (habitación, sala, cocina, baño...), ancho, largo y altura en metros.",
  "O usa el «📐 Asistente de medidas»: te pregunta las medidas paso a paso y va dibujando el plano solo, sin encimar espacios.",
]);
sub("3.2 Mover y editar");
li([
  "Arrastra un espacio en el Plano 2D para acomodarlo (se ajusta a pasos de 0.5 m).",
  "Toca un espacio para editar sus medidas o borrarlo.",
  "Con los botones Piso 1 / Piso 2 trabajas cada planta por separado.",
]);
sub("3.3 Instalaciones (redes)");
li([
  "Tres redes con su interruptor de ojo: ⚡ Eléctrica (naranja), 💧 Agua limpia (azul) y 🚽 Aguas sucias (café).",
  "Elige un símbolo (toma, interruptor, lámpara, tablero, llave, ducha, tanque, desagüe...) y toca el plano donde va.",
  "Para cables o tuberías: elige la herramienta de línea, toca los puntos del recorrido y dale «Guardar recorrido».",
  "Para borrar: toca el símbolo o la línea y confirma.",
]);

title("4. Vista 3D");
li([
  "Botón «Vista 3D»: ves los volúmenes de la casa con muros, techo y colores según el sistema constructivo.",
  "Las tres redes de instalaciones también se ven en 3D: cables arriba (2.2 m), agua a media pared (0.45 m) y aguas sucias a ras de piso.",
  "Puedes girar, acercar y explorar el diseño.",
]);

title("5. Plano técnico (para el arquitecto y la curaduría)");
li([
  "Botón «Plano técnico»: el plano sale en blanco y negro estilo arquitecto.",
  "Incluye: cotas (medidas) de cada espacio y generales, área en m² de cada espacio, indicador del norte y marco de plancha.",
  "Rótulo (cajetín) con: proyecto, propietario, dirección, escala, fecha, área del piso y número de plancha.",
  "Escribe el nombre del propietario en la casilla y dale «Guardar»: queda en el rótulo.",
  "Elige escala 1:50 o 1:100 y dale «Imprimir / PDF»: sale a tamaño real en el papel. Una plancha por piso.",
]);
p("IMPORTANTE: para el trámite de licencia de construcción, los planos deben ser revisados y firmados por un arquitecto con matrícula profesional. BioCasa te entrega el dibujo técnico como base.");

title("6. Cotizaciones");
sub("6.1 Cotización preliminar");
p("La app calcula automáticamente las cantidades de materiales según tus espacios y el sistema constructivo, con precios del catálogo en pesos colombianos (COP).");
sub("6.2 Cotización final");
p("Puedes ajustar a mano las cantidades de cada material y agregar otros costos (mano de obra, transporte, etc.) para llegar al valor real de la obra.");

title("7. Consejos y solución de problemas");
li([
  "La app funciona en celular y computador desde la misma dirección web.",
  "Si algo se ve raro o desactualizado, recarga la página (en celular: desliza hacia abajo; en computador: Ctrl+Shift+R).",
  "No actives el traductor automático del navegador en la app: puede dañar la pantalla.",
  "Los cambios se guardan solos en el servidor: puedes cerrar y volver cuando quieras.",
]);

doc.moveDown(1.5).fontSize(9).fillColor("#888").text("BioCasa — Manual de Usuario. Generado automáticamente.", { align: "center" });
doc.end();
console.log("OK " + out);
