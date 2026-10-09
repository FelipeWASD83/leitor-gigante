@echo off
rem Abre o Leitor gigante: sobe um servidorzinho na porta 4342 e abre o navegador.
rem Fecha esta janela preta quando terminar.
rem (Aberto direto do arquivo, o navegador nao deixa carregar os scripts.)
cd /d "%~dp0"
start "" "http://127.0.0.1:4342/"
python -m http.server 4342 --bind 127.0.0.1
