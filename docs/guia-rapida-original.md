# Guía Rápida - Bot de Ventas NFT

## Paso 1: Agregar Bot a tu Discord

**Haz clic en este enlace:** [Agregar Bot de Ventas NFT](https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands)

1. Selecciona tu servidor de Discord
2. Haz clic en "Autorizar"
3. El bot se unirá y enviará un mensaje de bienvenida

## Paso 2: Empezar a Rastrear Colecciones

Usa el comando `/add` para rastrear cualquier colección NFT:

```
/add token_id:TU_TOKEN_ID name:Nombre de la Colección
```

**Cómo encontrar token IDs:**
- Visita [SentX Marketplace](https://sentx.io/nft-marketplace)
- Explora colecciones y copia el token ID de la URL
- O pregunta a tu comunidad qué colecciones quieren rastrear

## Paso 3: Probar tu Configuración

Verifica que todo funcione:

```
/test type:Latest Listing
```

## Paso 4: Ver tus Colecciones

Mira qué estás rastreando:

```
/list
```

## Opcional: Canales Separados

Configura diferentes canales para ventas vs listados:

```
/set-listings-channel channel:#tu-canal-de-listados
```

## ¡Eso es Todo!

Tu bot ahora está monitoreando actividad NFT. Recibirás notificaciones cuando:
- Se vendan NFTs de las colecciones rastreadas
- Se listen nuevos NFTs para la venta

## Comandos Comunes

- `/add` - Rastrear nueva colección
- `/remove` - Dejar de rastrear colección
- `/list` - Mostrar colecciones rastreadas
- `/status` - Verificar estado del bot
- `/test` - Probar notificaciones

## ¿Necesitas Ayuda?

- Escribe `/status` para verificar si el bot funciona
- Usa `/test` para verificar que las notificaciones funcionen
- El bot funciona automáticamente una vez que se agregan colecciones

---

*¡Empieza a rastrear tus colecciones NFT favoritas de Hedera ahora!*