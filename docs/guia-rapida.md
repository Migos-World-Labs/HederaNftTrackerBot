# Guía Rápida - Bot de Ventas NFT para Discord

## 🚀 Configuración Inicial

### 1. Invitar el Bot a tu Servidor
```
https://discord.com/api/oauth2/authorize?client_id=1018256324519264265&permissions=19520&scope=bot%20applications.commands
```

### 2. Permisos Requeridos
- Ver Canales
- Enviar Mensajes  
- Insertar Enlaces
- Añadir Reacciones
- Usar Comandos de Barra

### 3. Configuración Automática
El bot se configurará automáticamente al unirse y enviará un mensaje de bienvenida.

## 📋 Comandos Principales

### Gestión de Colecciones
```
/add - Añadir colección NFT para rastrear
/remove - Eliminar colección específica
/remove-all - Eliminar TODAS las colecciones (requiere confirmación)
/list - Mostrar todas las colecciones rastreadas
```

### Configuración
```
/set-listings-channel - Configurar canal separado para listados
/status - Ver estado del bot y estadísticas del servidor
```

### Pruebas
```
/test - Probar funcionalidad del bot con varias opciones
```

## 🎯 Uso Básico

### Añadir una Colección NFT
1. Usa `/add`
2. Ingresa el Token ID (ej: `0.0.6024491`)
3. Ingresa el nombre de la colección (ej: `Wild Tigers`)
4. ¡Listo! El bot comenzará a monitorear esa colección

### Configurar Canal de Listados (Opcional)
1. Usa `/set-listings-channel`
2. Selecciona el canal deseado
3. Los listados irán al canal configurado
4. Las ventas seguirán en el canal principal

### Probar el Bot
1. Usa `/test`
2. Elige una opción de prueba
3. Opcionalmente selecciona una colección específica
4. Ver la notificación de prueba

## 📊 Tipos de Notificaciones

### Notificaciones de Ventas
- **Precio en HBAR y USD**
- **Información del comprador/vendedor**
- **Datos de rareza (SentX)**
- **Nivel de coleccionista (Ballena, Tiburón, etc.)**
- **Imagen del NFT**
- **Enlaces al marketplace**

### Notificaciones de Listados
- **Precio de listado**
- **Información del vendedor**
- **Datos de rareza**
- **Nivel de coleccionista**
- **Enlaces directos al NFT**

## 🏪 Marketplaces Soportados

### SentX (Primario)
- Datos de rareza autoritativos
- Información completa de colecciones
- Enlaces directos a NFTs

### Kabila (Secundario)
- Cobertura adicional de trading
- Enriquecido con datos de rareza de SentX
- Enlaces a colecciones de Kabila

## 💡 Consejos Útiles

### Token IDs Comunes
- **Wild Tigers**: `0.0.6024491`
- **The Ape Anthology**: `0.0.8308459`
- **Hashinals**: `0.0.5552189`
- **Hedera Monkeys**: `0.0.2173899`

### Mejores Prácticas
1. **Usa canales separados** para ventas y listados si tienes mucha actividad
2. **Prueba regularmente** con `/test` para verificar funcionamiento
3. **Revisa `/status`** para monitorear la salud del bot
4. **Usa `/list`** para revisar qué colecciones estás rastreando

### Solución de Problemas
- **Sin notificaciones**: Verifica que la colección esté añadida con `/list`
- **Errores de permisos**: Asegúrate que el bot tenga todos los permisos requeridos
- **Imágenes faltantes**: Es normal para algunos NFTs sin metadatos completos
- **Datos de rareza faltantes**: Algunos NFTs pueden no tener datos de rareza disponibles

## 🔄 Monitoreo Activo

El bot verifica nuevas ventas y listados cada **3 segundos** en:
- SentX marketplace
- Kabila marketplace

Solo procesa actividad de las colecciones que hayas añadido a tu servidor.

## 📞 Soporte

Para problemas o preguntas:
1. Usa `/status` para verificar el estado del bot
2. Prueba con `/test` para validar funcionalidad
3. Verifica permisos del bot en tu servidor
4. Revisa que las colecciones estén correctamente añadidas

---

*¡Disfruta rastreando tu actividad NFT favorita en Hedera!*