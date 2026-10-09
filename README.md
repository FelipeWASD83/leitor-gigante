# Leitor gigante

Abre arquivo de texto de qualquer tamanho no navegador sem travar. Nasceu de um
problema real: o Bloco de Notas do Windows engasgou ao abrir um `.txt` de
370 MB (os 369.693.100 dígitos de 9^9^9, uma linha só). Aqui o mesmo arquivo
abre na hora e a página usa uns 3 MB de memória.

## Como usar

1. Dê dois cliques em `abrir.bat`. Ele sobe um servidorzinho na porta 4342 e
   abre o navegador. (Aberto direto do arquivo, o navegador não carrega os
   scripts. Feche a janela preta quando terminar.)
2. Arraste um arquivo para a página, ou use **Abrir arquivo**. Não tem arquivo
   grande à mão? **Testar com 1 GB fictício** gera dígitos de mentira na hora.
3. Para andar pelo arquivo:
   - **Roda do mouse** rola. **Shift** + roda anda 20 vezes mais rápido,
     **Alt** + roda anda 200 vezes.
   - **A régua à direita** representa o arquivo inteiro: clique ou arraste para
     ir a qualquer ponto. Passando o mouse, ela mostra a posição exata.
   - **Teclado:** setas, PageUp, PageDown, Home, End e espaço.
   - **Ir para** (Ctrl+G): aceita `50 %`, `184.846.550` (posição em bytes) ou
     `100M` (cem milhões; também `k` e `G`).
   - No celular, arraste o texto com o dedo.
4. **Busca** (Ctrl+F): procura no arquivo inteiro e conta quantos acertos tem.
   Enter vai para o próximo, Shift+Enter para o anterior. Onde há acertos,
   a régua fica marcada de vermelho. O botão **Aa** liga e desliga "ignorar
   maiúsculas" (só vale para A a Z, sem acento).
5. **A− / A+** mudam a letra. **Grupos de 10** separa os caracteres de 10 em 10
   só na tela (ótimo para ler dígitos; o arquivo não muda). **Copiar tela**
   copia o texto que está aparecendo.

## O que ele não faz

- Não edita nem salva: só lê.
- Não guarda o arquivo aberto: se apertar F5, é preciso abrir de novo.
- Copiar pega só o que está na tela (arquivo inteiro não cabe na área de
  transferência).
- Lê como texto UTF-8. Arquivo binário abre, mas o que não for texto aparece
  como pontinhos (a página avisa).
- Letras largas (japonês, emoji) não alinham na grade de colunas.

## Privacidade

Nada sai do computador. A página não faz nenhuma requisição além de carregar
os próprios arquivos, e o navegador só lê do disco o pedaço que aparece na tela
(mais as varreduras da busca). Só ficam salvos no navegador o tamanho da letra,
os grupos de 10 e o "Aa".
