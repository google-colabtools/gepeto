from flask import Flask, render_template_string, send_from_directory, abort, url_for, request, redirect, send_file, jsonify
import os
from werkzeug.utils import secure_filename
import time
import zipfile
import tempfile
import shutil

app = Flask(__name__)

# Adicione isso no início do seu arquivo, após criar o app Flask
@app.after_request
def allow_iframe_and_cors(response):
    # Remove X-Frame-Options para permitir iframe
    response.headers.pop('X-Frame-Options', None)
    
    # Adiciona cabeçalhos CORS para permitir requisições AJAX
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Max-Age'] = '86400'
    
    return response

# Define o diretório base para o explorador de arquivos
BASE_DIR = os.getcwd()

START_TIME = time.time()

@app.route('/')
def home():
    uptime_seconds = int(time.time() - START_TIME)
    return f'''
    <html>
        <head>
            <title>App is Running</title>
            <style>
                body {{
                    background: #23272e;
                    color: #c7d0dc;
                    font-family: 'Segoe UI', 'Arial', sans-serif;
                    margin: 0;
                    padding: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }}
                .container {{
                    background: #2c313c;
                    padding: 40px 60px;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
                    text-align: center;
                }}
                h1 {{
                    color: #7ecfff;
                    margin-bottom: 12px;
                }}
                p {{
                    color: #c7d0dc;
                    font-size: 1.2em;
                }}
                .button {{
                    display: inline-block;
                    margin-top: 25px;
                    padding: 12px 24px;
                    background-color: #7ecfff;
                    color: #23272e;
                    text-decoration: none;
                    font-weight: 600;
                    border-radius: 8px;
                    transition: background-color 0.3s, transform 0.2s;
                    cursor: pointer;
                    border: none;
                }}
                .button:hover {{
                    background-color: #a2e0ff;
                    transform: translateY(-2px);
                }}
                
                /* Estilos do Modal */
                .modal {{
                    display: none;
                    position: fixed;
                    z-index: 1000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.8);
                }}
                .modal-content {{
                    background: #2c313c;
                    margin: 2% auto;
                    padding: 0;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 1000px;
                    height: 90%;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                    display: flex;
                    flex-direction: column;
                }}
                .modal-header {{
                    background: #23272e;
                    padding: 20px;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                .modal-header h2 {{
                    color: #7ecfff;
                    margin: 0;
                }}
                .close {{
                    color: #c7d0dc;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: color 0.3s;
                }}
                .close:hover {{
                    color: #7ecfff;
                }}
                .modal-body {{
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }}
                
                /* Estilos do explorador de arquivos no modal */
                .file-explorer {{
                    color: #c7d0dc;
                }}
                .file-explorer h3 {{
                    color: #7ecfff;
                    border-bottom: 1px solid #4f5b6a;
                    padding-bottom: 10px;
                    margin-top: 20px;
                }}
                .file-explorer ul {{
                    list-style-type: none;
                    padding: 0;
                }}
                .file-explorer li {{
                    padding: 8px 12px;
                    border-bottom: 1px solid #3a424d;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                .file-explorer li:last-child {{
                    border-bottom: none;
                }}
                .file-explorer a {{
                    color: #7ecfff;
                    text-decoration: none;
                    font-weight: 500;
                }}
                .file-explorer a:hover {{
                    text-decoration: underline;
                }}
                .dir::before {{
                    content: '📁';
                    margin-right: 10px;
                }}
                .file::before {{
                    content: '📄';
                    margin-right: 10px;
                }}
                .breadcrumbs {{
                    margin-bottom: 20px;
                    padding: 10px;
                    background-color: #23272e;
                    border-radius: 5px;
                }}
                .breadcrumbs a {{
                    color: #c7d0dc;
                    text-decoration: none;
                    cursor: pointer;
                }}
                .breadcrumbs a:hover {{
                    color: #7ecfff;
                }}
                .breadcrumbs span {{
                    color: #777;
                    margin: 0 5px;
                }}
                .upload-form {{
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #3a424d;
                    border-radius: 8px;
                }}
                .upload-form input[type="file"] {{
                    color: #c7d0dc;
                    margin-bottom: 10px;
                    width: 100%;
                }}
                .upload-form input[type="submit"] {{
                    background-color: #7ecfff;
                    color: #23272e;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }}
                .upload-form input[type="submit"]:hover {{
                    background-color: #a2e0ff;
                }}
                .item-actions {{
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }}
                .download-btn {{
                    background-color: #28a745;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    text-decoration: none;
                    transition: background-color 0.3s;
                }}
                .download-btn:hover {{
                    background-color: #218838;
                }}
                .spoiler {{
                    margin: 20px 0;
                    border: 1px solid #4f5b6a;
                    border-radius: 8px;
                    background-color: #3a424d;
                }}
                .spoiler-header {{
                    padding: 15px;
                    cursor: pointer;
                    background-color: #2c313c;
                    border-radius: 8px 8px 0 0;
                    user-select: none;
                    transition: background-color 0.3s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                .spoiler-header:hover {{
                    background-color: #343a47;
                }}
                .spoiler-header h3 {{
                    margin: 0;
                    border-bottom: none;
                    padding-bottom: 0;
                }}
                .spoiler-arrow {{
                    transition: transform 0.3s;
                    font-size: 16px;
                }}
                .spoiler-arrow.open {{
                    transform: rotate(90deg);
                }}
                .spoiler-content {{
                    padding: 0 15px;
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease, padding 0.3s ease;
                }}
                .spoiler-content.open {{
                    max-height: 500px;
                    padding: 15px;
                }}
                .loading {{
                    text-align: center;
                    padding: 20px;
                    color: #7ecfff;
                }}
            </style>
            <script>
                let uptime = {uptime_seconds};
                let currentPath = '';
                
                function formatUptime(s) {{
                    let h = Math.floor(s/3600);
                    let m = Math.floor((s%3600)/60);
                    let sec = s%60;
                    return h.toString().padStart(2,'0')+':'+m.toString().padStart(2,'0')+':'+sec.toString().padStart(2,'0');
                }}
                
                function updateUptime() {{
                    uptime += 1;
                    document.getElementById('uptime').innerText = formatUptime(uptime);
                }}
                
                function openFileExplorer() {{
                    document.getElementById('fileModal').style.display = 'block';
                    loadDirectory('');
                }}
                
                function closeFileExplorer() {{
                    document.getElementById('fileModal').style.display = 'none';
                }}
                
                function loadDirectory(path) {{
                    currentPath = path;
                    const modalBody = document.getElementById('modalBody');
                    modalBody.innerHTML = '<div class="loading">Carregando...</div>';
                    
                    fetch('/api/files' + (path ? '/' + path : ''))
                        .then(response => {{
                            if (!response.ok) {{
                                throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                            }}
                            return response.json();
                        }})
                        .then(data => {{
                            modalBody.innerHTML = generateFileExplorerHTML(data);
                        }})
                        .catch(error => {{
                            console.error('Error loading files:', error);
                            modalBody.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center;">' +
                                '<h3>Erro ao carregar arquivos</h3>' +
                                '<p><strong>Detalhes:</strong> ' + error.message + '</p>' +
                                '<p><strong>Possíveis soluções:</strong></p>' +
                                '<ul style="text-align: left; display: inline-block;">' +
                                '<li>Verifique se o servidor está rodando</li>' +
                                '<li>Verifique a URL no navegador</li>' +
                                '<li>Tente recarregar a página</li>' +
                                '<li>Verifique o console do navegador para mais detalhes</li>' +
                                '</ul>' +
                                '</div>';
                        }});
                }}
                
                function generateFileExplorerHTML(data) {{
                    let html = '<div class="file-explorer">';
                    
                    // Breadcrumbs
                    html += '<div class="breadcrumbs">';
                    html += '<a onclick="loadDirectory(\\'\\')">home</a>';
                    if (data.current_path) {{
                        const pathParts = data.current_path.split('/');
                        for (let i = 0; i < pathParts.length; i++) {{
                            if (pathParts[i]) {{
                                html += '<span>/</span>';
                                const pathToHere = pathParts.slice(0, i + 1).join('/');
                                html += '<a onclick="loadDirectory(\\'' + pathToHere + '\\')">' + pathParts[i] + '</a>';
                            }}
                        }}
                    }}
                    html += '</div>';
                    
                    // Upload form
                    html += '<div class="spoiler">';
                    html += '<div class="spoiler-header" onclick="toggleSpoiler(this)">';
                    html += '<h3>📤 Upload de Arquivos</h3>';
                    html += '<span class="spoiler-arrow">▶</span>';
                    html += '</div>';
                    html += '<div class="spoiler-content">';
                    html += '<form class="upload-form" onsubmit="uploadFiles(event)">';
                    html += '<input type="file" name="files" multiple required>';
                    html += '<div style="font-size: 12px; color: #888; margin-top: 5px;">💡 Você pode selecionar múltiplos arquivos segurando Ctrl (Windows/Linux) ou Cmd (Mac)</div>';
                    html += '<input type="submit" value="Upload">';
                    html += '</form>';
                    html += '</div>';
                    html += '</div>';
                    
                    // Directories
                    html += '<h3>Diretórios</h3>';
                    html += '<ul>';
                    if (data.dirs && data.dirs.length > 0) {{
                        data.dirs.forEach(dir => {{
                            const fullPath = data.current_path ? data.current_path + '/' + dir : dir;
                            html += '<li>';
                            html += '<a class="dir" onclick="loadDirectory(\\'' + fullPath + '\\')">' + dir + '</a>';
                            html += '<div class="item-actions">';
                            html += '<a href="/download_folder/' + fullPath + '" class="download-btn">📥 ZIP</a>';
                            html += '</div>';
                            html += '</li>';
                        }});
                    }} else {{
                        html += '<li>Nenhum diretório encontrado.</li>';
                    }}
                    html += '</ul>';
                    
                    // Files
                    html += '<h3>Arquivos</h3>';
                    html += '<ul>';
                    if (data.files && data.files.length > 0) {{
                        data.files.forEach(file => {{
                            const fullPath = data.current_path ? data.current_path + '/' + file : file;
                            html += '<li>';
                            html += '<a class="file" href="/files/' + fullPath + '">' + file + '</a>';
                            html += '<div class="item-actions">';
                            html += '<a href="/files/' + fullPath + '" class="download-btn">📥 Download</a>';
                            html += '</div>';
                            html += '</li>';
                        }});
                    }} else {{
                        html += '<li>Nenhum arquivo encontrado.</li>';
                    }}
                    html += '</ul>';
                    
                    html += '</div>';
                    return html;
                }}
                
                function toggleSpoiler(element) {{
                    const content = element.nextElementSibling;
                    const arrow = element.querySelector('.spoiler-arrow');
                    
                    if (content.classList.contains('open')) {{
                        content.classList.remove('open');
                        arrow.classList.remove('open');
                    }} else {{
                        content.classList.add('open');
                        arrow.classList.add('open');
                    }}
                }}
                
                function uploadFiles(event) {{
                    event.preventDefault();
                    const formData = new FormData(event.target);
                    
                    fetch('/api/upload' + (currentPath ? '/' + currentPath : ''), {{
                        method: 'POST',
                        body: formData
                    }})
                    .then(response => {{
                        if (!response.ok) {{
                            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                        }}
                        return response.json();
                    }})
                    .then(data => {{
                        if (data.success) {{
                            loadDirectory(currentPath); // Recarrega o diretório
                        }} else {{
                            alert('Erro no upload: ' + data.message);
                        }}
                    }})
                    .catch(error => {{
                        console.error('Error uploading files:', error);
                        alert('Erro no upload: ' + error.message + '\\n\\nVerifique o console para mais detalhes.');
                    }});
                }}
                
                // Event listeners
                window.onclick = function(event) {{
                    const modal = document.getElementById('fileModal');
                    if (event.target == modal) {{
                        closeFileExplorer();
                    }}
                }}
                
                setInterval(updateUptime, 1000);
                window.onload = function() {{
                    document.getElementById('uptime').innerText = formatUptime(uptime);
                }};
            </script>
        </head>
        <body>
            <div class="container">
                <h1>App is Running...</h1>
                <p>Seu serviço Flask está ativo e pronto!</p>
                <p><b>Uptime:</b> <span id="uptime"></span></p>
                <button onclick="openFileExplorer()" class="button">Explorar Arquivos</button>
            </div>
            
            <!-- Modal do Explorador de Arquivos -->
            <div id="fileModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>File Explorer</h2>
                        <span class="close" onclick="closeFileExplorer()">&times;</span>
                    </div>
                    <div class="modal-body" id="modalBody">
                        <div class="loading">Carregando...</div>
                    </div>
                </div>
            </div>
        </body>
    </html>
    '''

# API routes para o explorador de arquivos no modal

# Rota para lidar com requisições OPTIONS (CORS preflight)
@app.route('/api/files/', methods=['OPTIONS'])
@app.route('/api/files/<path:subpath>', methods=['OPTIONS'])
@app.route('/api/upload/', methods=['OPTIONS'])
@app.route('/api/upload/<path:subpath>', methods=['OPTIONS'])
def options_handler(subpath=''):
    """Handle CORS preflight requests"""
    return jsonify({'status': 'OK'}), 200

@app.route('/api/files/')
@app.route('/api/files/<path:subpath>')
def api_file_list(subpath=''):
    """Retorna dados JSON para o explorador de arquivos no modal"""
    safe_base_dir = os.path.abspath(BASE_DIR)
    requested_path = os.path.abspath(os.path.join(safe_base_dir, subpath))

    if not requested_path.startswith(safe_base_dir) or not os.path.exists(requested_path):
        return {'error': 'Caminho não encontrado'}, 404

    if not os.path.isdir(requested_path):
        return {'error': 'Não é um diretório'}, 400

    try:
        items = sorted(os.listdir(requested_path), key=str.lower)
        dirs = [item for item in items if os.path.isdir(os.path.join(requested_path, item))]
        files = [item for item in items if os.path.isfile(os.path.join(requested_path, item))]

        return {
            'success': True,
            'current_path': subpath,
            'dirs': dirs,
            'files': files
        }
    except Exception as e:
        return {'error': str(e)}, 500

@app.route('/api/upload/', methods=['POST'])
@app.route('/api/upload/<path:subpath>', methods=['POST'])
def api_upload_files(subpath=''):
    """API para upload de arquivos via modal"""
    safe_base_dir = os.path.abspath(BASE_DIR)
    requested_path = os.path.abspath(os.path.join(safe_base_dir, subpath))

    if not requested_path.startswith(safe_base_dir) or not os.path.exists(requested_path) or not os.path.isdir(requested_path):
        return {'success': False, 'message': 'Diretório não encontrado'}, 404

    try:
        if 'files' not in request.files:
            return {'success': False, 'message': 'Nenhum arquivo enviado'}, 400
        
        files = request.files.getlist('files')
        uploaded_count = 0
        
        for file in files:
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                if filename:
                    file.save(os.path.join(requested_path, filename))
                    uploaded_count += 1
        
        if uploaded_count > 0:
            return {'success': True, 'message': f'{uploaded_count} arquivo(s) enviado(s) com sucesso'}
        else:
            return {'success': False, 'message': 'Nenhum arquivo válido foi enviado'}, 400
            
    except Exception as e:
        return {'success': False, 'message': f'Erro no upload: {str(e)}'}, 500

@app.route('/download_folder/<path:subpath>')
def download_folder(subpath):
    safe_base_dir = os.path.abspath(BASE_DIR)
    folder_path = os.path.abspath(os.path.join(safe_base_dir, subpath))
    
    if not folder_path.startswith(safe_base_dir) or not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        abort(404)
    
    # Cria um arquivo temporário ZIP
    temp_dir = tempfile.mkdtemp()
    folder_name = os.path.basename(folder_path)
    zip_filename = f"{folder_name}.zip"
    zip_path = os.path.join(temp_dir, zip_filename)
    
    try:
        # Cria o arquivo ZIP
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, folder_path)
                    zipf.write(file_path, arcname)
        
        # Envia o arquivo ZIP
        return send_file(zip_path, as_attachment=True, download_name=zip_filename, mimetype='application/zip')
    
    except Exception as e:
        # Limpa o diretório temporário em caso de erro
        shutil.rmtree(temp_dir, ignore_errors=True)
        abort(500)

@app.route('/files/', methods=['GET', 'POST'])
@app.route('/files/<path:subpath>', methods=['GET', 'POST'])
def file_explorer(subpath=''):
    """Rota simplificada para download direto de arquivos"""
    safe_base_dir = os.path.abspath(BASE_DIR)
    requested_path = os.path.abspath(os.path.join(safe_base_dir, subpath))

    if not requested_path.startswith(safe_base_dir) or not os.path.exists(requested_path):
        abort(404)

    if os.path.isdir(requested_path):
        # Se for um diretório, redireciona para a página principal com modal
        return redirect('/')
    else:
        # Se for um arquivo, faz o download
        directory = os.path.dirname(requested_path)
        filename = os.path.basename(requested_path)
        
        # Lista de extensões que devem ser forçadamente baixadas
        binary_extensions = [
            '.zip', '.rar', '.7z', '.tar', '.gz',
            '.exe', '.msi', '.dmg', '.deb',
            '.bin', '.iso', '.img', '.dll', '.so',
            '.doc', '.docx', '.xls', '.xlsx',
            '.ppt', '.pptx',
            '.mp3', '.wav', '.mp4', '.avi', '.mkv'
        ]

        force_download = any(filename.lower().endswith(ext) for ext in binary_extensions)
        return send_from_directory(directory, filename, as_attachment=force_download)

if __name__ == "__main__":
    # Configure o Flask para aceitar conexões de qualquer IP (importante para Linux/Docker)
    app.run(host='0.0.0.0', port=5000, debug=False)