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
5. **Zoom para afastar (mínimo de 7 %).** O contador no topo (`A−  100 %  A+`) é o
   tamanho da letra: 100 % é a letra de 16 px. Quanto menor o zoom, mais
   caracteres cabem na tela. Clique em A− ou A+, use **Ctrl + roda do mouse**,
   ou digite o valor no contador e aperte Enter (aceita `35`, `12,5`; **Ctrl+0**
   volta para 100). O rodapé mostra quantos caracteres estão na tela e quanto
   tempo a pintura levou.
   Um zoom abaixo de 63 % (letra menor que 10 px) não é lembrado ao recarregar,
   para a página nunca abrir já travada.
6. **Grupos de 10** separa os caracteres de 10 em 10 só na tela (ótimo para ler
   dígitos; o arquivo não muda). **Copiar tela** copia o texto que está
   aparecendo.

### O limite de afastar

O zoom mínimo é **7 %** (o ponto onde você disse que a tela começa a lagar).
Para mudar, no arquivo `js/main.js` procure a linha `const ZOOM_MINIMO = 7;` e
troque o número (em %). Digitar um valor menor que 7 no contador também
funciona, mas ele para em 7 e avisa.

## Arquivos para testar

Ficam em `C:\Users\felipe\Documents\arquivos-gigantes` (fora do projeto, para
não pesar nos backups da nuvem): `10_elevado_50.txt` e `10_elevado_100.txt` (o
número escrito, um 1 e os zeros: 51 e 101 caracteres), `9_elevado_9_elevado_9.txt`
(369.693.100 dígitos) e `letras_aleatorias_369693100.txt` (o mesmo tamanho, só
letras de a a z sorteadas).

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
