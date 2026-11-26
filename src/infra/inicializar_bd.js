// src/infra/inicializar_bd.js
import fs from 'node:fs';
import pg from 'pg';

const { Client } = pg;

async function inicializar() {
  const urlObjetivo = new URL(process.env.DATABASE_URL);
  const nombreBd = urlObjetivo.pathname.slice(1);

  // 1. Conectar a la BD por defecto 'postgres' para crear 'pulsolive' si no existe
  const urlAdmin = new URL(process.env.DATABASE_URL);
  urlAdmin.pathname = '/postgres';

  const clienteAdmin = new Client({ connectionString: urlAdmin.toString() });
  await clienteAdmin.connect();

  const existe = await clienteAdmin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [nombreBd]
  );

  if (existe.rowCount === 0) {
    console.log(`Creando base de datos "${nombreBd}"...`);
    await clienteAdmin.query(`CREATE DATABASE ${nombreBd}`);
  } else {
    console.log(`La base de datos "${nombreBd}" ya existe.`);
  }
  await clienteAdmin.end();

  // 2. Conectar a 'pulsolive' y ejecutar esquema + datos sintéticos
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  console.log('Ejecutando sql/01_esquema.sql...');
  const esquemaSql = fs.readFileSync('sql/01_esquema.sql', 'utf8');
  await cliente.query(esquemaSql);

  const conteo = await cliente.query('SELECT COUNT(*)::int AS total FROM usuarios');
  if (conteo.rows[0].total === 0) {
    console.log('Cargando 5 050 usuarios y 2 000 000 de propinas (esto tarda unos 10-20 segundos)...');
    const datosSql = fs.readFileSync('sql/02_datos_sinteticos.sql', 'utf8');
    await cliente.query(datosSql);
    console.log('¡Carga de datos sintéticos completada con éxito!');
  } else {
    console.log('Los datos sintéticos ya estaban cargados.');
  }

  const resumen = await cliente.query(`
    SELECT
      (SELECT COUNT(*) FROM usuarios) AS usuarios,
      (SELECT COUNT(*) FROM billeteras) AS billeteras,
      (SELECT COUNT(*) FROM propinas) AS propinas
  `);
  console.table(resumen.rows);

  await cliente.end();
}

inicializar().catch((err) => {
  console.error('Error al inicializar la base de datos:', err.message);
  process.exit(1);
});