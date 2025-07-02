const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/licencia", async (req, res) => {
  const dni = req.query.dni;
  if (!dni || dni.length !== 8) {
    return res.status(400).json({ error: "DNI inválido" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();
    await page.goto("https://licencias.mtc.gob.pe/#/index", { waitUntil: "networkidle2" });

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const cookie = (await page.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    await browser.close();

    const response = await fetch("https://licencias.mtc.gob.pe/api/puntos/consultaConsolidado", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Cookie": cookie,
        "Origin": "https://licencias.mtc.gob.pe",
        "Referer": "https://licencias.mtc.gob.pe/"
      },
      body: JSON.stringify({
        TipoBusqueda: 0,
        TipoDocumento: 2,
        NumDocumento: dni,
        NumLicencia: "",
        ApePaterno: "",
        ApeMaterno: "",
        Nombre: ""
      })
    });

    const data = await response.json();

    if (!data || !data.Data || !data.Data.Administrado) {
      return res.status(404).json({ error: "No se encontró información" });
    }

    const info = data.Data.Administrado;
    const infracciones = data.Data.ListaPapeleta.map(p => ({
      fecha: p.fec_infraccion,
      entidad: p.entidad,
      falta: p.falta,
      puntos: p.puntos_firmes
    }));

    res.json({
      nombre: info.var_administrado,
      dni: info.var_numdocumento,
      estado: info.estado,
      puntos: info.PtsAcumulados,
      mensaje: info.MensajeLimite,
      infracciones
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al consultar datos" });
  }
});

app.listen(PORT, () => console.log("✅ Servidor escuchando en puerto", PORT));