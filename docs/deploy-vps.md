# Deploy na VPS Debian

Este procedimento publica o Hands-on SAP Inside Track Fortaleza 2026 em `http://152.239.118.120`, usando Docker Compose e SQLite persistente.

Os comandos abaixo são executados dentro da VPS como `root`. A instalação segue o repositório oficial do Docker para Debian 13 (Trixie).

> Nunca envie a chave privada SSH para a VPS, para o GitHub ou para outra pessoa. Ela deve permanecer somente no seu Mac.

> Nunca adicione o arquivo `.env` ao Git. Ele contém as credenciais administrativas.

> Nunca execute `docker compose down -v`. A opção `-v` apaga o volume com participantes, Hands-on, inscrições e data final.

## 1. Instalar o Docker Engine e o Compose

Remova pacotes conflitantes, caso existam:

```bash
apt-get remove -y docker.io docker-compose docker-doc docker-buildx podman-docker containerd runc || true
```

Configure o repositório oficial:

```bash
apt-get update
apt-get install -y ca-certificates curl git openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```bash
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker run --rm hello-world
docker compose version
```

No firewall da Hostinger, mantenha SSH/TCP 22 disponível para administração e libere HTTP/TCP 80 para o site. Não exponha a porta interna 3000 diretamente.

## 2. Clonar o projeto

```bash
cd /opt
git clone https://github.com/JonysArcanjo/hands-on-sit-fortaleza-2026.git
cd hands-on-sit-fortaleza-2026
```

## 3. Criar a configuração protegida

O bloco abaixo solicita a senha sem exibi-la, calcula o hash e cria `.env` com permissão somente para `root`:

```bash
umask 077
read -r -p "E-mail administrativo: " ADMIN_EMAIL
read -r -s -p "Senha administrativa: " ADMIN_PASSWORD
echo
ADMIN_PASSWORD_HASH=$(printf '%s' "$ADMIN_PASSWORD" | sha256sum | cut -d' ' -f1)
SESSION_SECRET=$(openssl rand -hex 32)
printf 'ADMIN_EMAIL=%s\nADMIN_PASSWORD_HASH=%s\nSESSION_SECRET=%s\nDATABASE_PATH=/app/data/hands-on.db\nHOSTNAME=0.0.0.0\nPORT=3000\n' \
  "$ADMIN_EMAIL" "$ADMIN_PASSWORD_HASH" "$SESSION_SECRET" >.env
unset ADMIN_PASSWORD ADMIN_PASSWORD_HASH SESSION_SECRET
chmod 600 .env
```

Confirme somente os nomes das variáveis, sem imprimir os valores:

```bash
cut -d= -f1 .env
```

O resultado esperado contém `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `DATABASE_PATH`, `HOSTNAME` e `PORT`.

## 4. Construir e iniciar

```bash
docker compose up -d --build
docker compose ps
```

A primeira construção pode levar alguns minutos. Aguarde até o serviço `app` aparecer como `healthy`.

## 5. Verificar o serviço

```bash
curl --fail --show-error http://127.0.0.1/api/health
docker compose logs --tail=100 app
```

O healthcheck deve retornar:

```json
{"status":"ok","database":"ok"}
```

No smartphone, abra:

- inscrição: `http://152.239.118.120`
- administração: `http://152.239.118.120/admin/login`

Valide o login, a data final das inscrições, a importação de participantes, uma inscrição de teste e o download CSV. Como o primeiro acesso usa HTTP por IP, não reutilize essa senha administrativa em nenhum outro serviço.

## 6. Consultar estado e logs

```bash
cd /opt/hands-on-sit-fortaleza-2026
docker compose ps
docker compose logs --tail=200 app
docker compose logs --follow app
```

Use `Ctrl+C` para sair do acompanhamento dos logs; isso não encerra o contêiner.

## 7. Atualizar a aplicação

Faça um backup antes de cada atualização. Depois:

```bash
cd /opt/hands-on-sit-fortaleza-2026
git pull --ff-only
docker compose up -d --build
docker compose ps
curl --fail --show-error http://127.0.0.1/api/health
```

O comando recria a aplicação sem remover `hands_on_data`.

## 8. Fazer backup do SQLite

Interrompa brevemente a aplicação para produzir uma cópia consistente:

```bash
cd /opt/hands-on-sit-fortaleza-2026
mkdir -p backups
chmod 700 backups
BACKUP_FILE="backups/hands-on-$(date +%Y%m%d-%H%M%S).db"
docker compose stop app
docker cp "$(docker compose ps -aq app):/app/data/hands-on.db" "$BACKUP_FILE"
test -s "$BACKUP_FILE"
docker compose start app
docker compose up -d --wait --wait-timeout 90
printf 'Backup criado: %s\n' "$BACKUP_FILE"
```

Copie periodicamente os arquivos de `backups/` para outro equipamento. Um backup armazenado apenas na mesma VPS não protege contra perda do servidor.

## 9. Restaurar um backup

Defina explicitamente o arquivo correto antes de continuar:

```bash
cd /opt/hands-on-sit-fortaleza-2026
RESTORE_FILE="backups/hands-on-AAAAMMDD-HHMMSS.db"
test -s "$RESTORE_FILE"
docker compose stop app
CONTAINER_ID=$(docker compose ps -aq app)
docker cp "$RESTORE_FILE" "$CONTAINER_ID:/app/data/hands-on.db.restore"
docker compose run --rm --no-deps --user root --entrypoint sh app -c \
  'cp /app/data/hands-on.db /app/data/hands-on.db.before-restore && mv /app/data/hands-on.db.restore /app/data/hands-on.db && rm -f /app/data/hands-on.db-wal /app/data/hands-on.db-shm && chown 1001:1001 /app/data/hands-on.db'
docker compose start app
docker compose up -d --wait --wait-timeout 90
curl --fail --show-error http://127.0.0.1/api/health
```

Se a validação falhar, pare a aplicação e restaure `/app/data/hands-on.db.before-restore` antes de iniciar novamente.

## 10. Diagnóstico rápido

### Porta 80 ocupada

```bash
ss -ltnp | grep ':80 '
```

Pare ou reconfigure o serviço conflitante antes de iniciar o Compose.

### Aplicação sem permissão para o banco

```bash
docker compose run --rm --no-deps --user root --entrypoint sh app -c 'chown -R 1001:1001 /app/data'
docker compose up -d
```

### Serviço não fica saudável

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(async response => { console.log(response.status, await response.text()); process.exit(response.ok ? 0 : 1) }).catch(error => { console.error(error); process.exit(1) })"
```

### Banco e volume

```bash
docker compose exec app ls -lh /app/data
docker volume ls | grep hands_on_data
```

Não remova o volume para tentar corrigir um erro. Preserve os dados e faça um backup antes de qualquer intervenção.
