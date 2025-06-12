/**
 * Simple web interface for managing tracked NFT collections
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const collectionsPath = path.join(__dirname, 'collections.json');

// Load collections
function loadCollections() {
    try {
        if (fs.existsSync(collectionsPath)) {
            return JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading collections:', error);
    }
    return { collections: [] };
}

// Save collections
function saveCollections(data) {
    try {
        fs.writeFileSync(collectionsPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving collections:', error);
        return false;
    }
}

// Serve main page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>NFT Sales Bot - Collection Manager</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        input, select {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        button {
            background: #5865f2;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            margin-right: 10px;
        }
        button:hover {
            background: #4752c4;
        }
        .delete-btn {
            background: #ed4245;
            padding: 5px 10px;
            font-size: 12px;
        }
        .delete-btn:hover {
            background: #c23e41;
        }
        .collection-item {
            background: #f9f9f9;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #5865f2;
        }
        .collection-item.disabled {
            opacity: 0.6;
            border-left-color: #ccc;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            display: none;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
        }
        .slider:before {
            position: absolute;
            content: "";
            height: 26px;
            width: 26px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .slider {
            background-color: #5865f2;
        }
        input:checked + .slider:before {
            transform: translateX(26px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 NFT Sales Bot - Collection Manager</h1>
        
        <div id="status" class="status"></div>
        
        <h3>Add New Collection</h3>
        <form id="addForm">
            <div class="form-group">
                <label for="tokenId">Token ID (e.g., 0.0.878200):</label>
                <input type="text" id="tokenId" placeholder="0.0.123456" required pattern="0\\.0\\.\\d+">
            </div>
            <div class="form-group">
                <label for="name">Collection Name:</label>
                <input type="text" id="name" placeholder="Dead Pixels Ghost Club" required>
            </div>
            <button type="submit">Add Collection</button>
        </form>
        
        <h3>Tracked Collections</h3>
        <div id="collections">
            Loading...
        </div>
        
        <button onclick="loadCollections()">Refresh</button>
    </div>

    <script>
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }

        async function loadCollections() {
            try {
                const response = await fetch('/api/collections');
                const data = await response.json();
                
                const container = document.getElementById('collections');
                if (data.collections.length === 0) {
                    container.innerHTML = '<p>No collections added yet.</p>';
                    return;
                }
                
                container.innerHTML = data.collections.map((collection, index) => \`
                    <div class="collection-item \${collection.enabled ? '' : 'disabled'}">
                        <strong>\${collection.name}</strong><br>
                        <small>Token ID: \${collection.tokenId}</small><br>
                        <div style="margin-top: 10px;">
                            <label class="toggle-switch">
                                <input type="checkbox" \${collection.enabled ? 'checked' : ''} 
                                       onchange="toggleCollection(\${index})">
                                <span class="slider"></span>
                            </label>
                            <span style="margin-left: 10px;">\${collection.enabled ? 'Enabled' : 'Disabled'}</span>
                            <button class="delete-btn" onclick="deleteCollection(\${index})">Delete</button>
                        </div>
                    </div>
                \`).join('');
            } catch (error) {
                showStatus('Error loading collections: ' + error.message, 'error');
            }
        }

        async function toggleCollection(index) {
            try {
                const response = await fetch('/api/collections/' + index + '/toggle', {
                    method: 'POST'
                });
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Collection updated successfully', 'success');
                    loadCollections();
                } else {
                    showStatus('Error updating collection', 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        async function deleteCollection(index) {
            if (!confirm('Are you sure you want to delete this collection?')) return;
            
            try {
                const response = await fetch('/api/collections/' + index, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Collection deleted successfully', 'success');
                    loadCollections();
                } else {
                    showStatus('Error deleting collection', 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        document.getElementById('addForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tokenId = document.getElementById('tokenId').value;
            const name = document.getElementById('name').value;
            
            try {
                const response = await fetch('/api/collections', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tokenId, name })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Collection added successfully', 'success');
                    document.getElementById('addForm').reset();
                    loadCollections();
                } else {
                    showStatus(result.message || 'Error adding collection', 'error');
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        });

        // Load collections on page load
        loadCollections();
    </script>
</body>
</html>
    `);
});

// API Routes
app.get('/api/collections', (req, res) => {
    const data = loadCollections();
    res.json(data);
});

app.post('/api/collections', (req, res) => {
    const { tokenId, name } = req.body;
    
    if (!tokenId || !name) {
        return res.json({ success: false, message: 'Token ID and name are required' });
    }
    
    if (!tokenId.match(/^0\.0\.\d+$/)) {
        return res.json({ success: false, message: 'Invalid token ID format. Use: 0.0.123456' });
    }
    
    const data = loadCollections();
    
    // Check if collection already exists
    if (data.collections.some(c => c.tokenId === tokenId)) {
        return res.json({ success: false, message: 'Collection already exists' });
    }
    
    data.collections.push({
        tokenId,
        name,
        enabled: true,
        addedDate: new Date().toISOString()
    });
    
    if (saveCollections(data)) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Error saving collection' });
    }
});

app.post('/api/collections/:index/toggle', (req, res) => {
    const index = parseInt(req.params.index);
    const data = loadCollections();
    
    if (index >= 0 && index < data.collections.length) {
        data.collections[index].enabled = !data.collections[index].enabled;
        
        if (saveCollections(data)) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Error updating collection' });
        }
    } else {
        res.json({ success: false, message: 'Collection not found' });
    }
});

app.delete('/api/collections/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const data = loadCollections();
    
    if (index >= 0 && index < data.collections.length) {
        data.collections.splice(index, 1);
        
        if (saveCollections(data)) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Error deleting collection' });
        }
    } else {
        res.json({ success: false, message: 'Collection not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Collection manager running at http://localhost:${PORT}`);
});

module.exports = app;