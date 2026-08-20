# Memory Alert Monitor 🧠🔋

[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-%E2%89%A5%2048-blue.svg)](https://extensions.gnome.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Linter: Shexli Clean](https://img.shields.io/badge/shexli-clean-brightgreen.svg)](#-verificação-e-qualidade-linter)

Um monitor de memória de alto desempenho, assíncrono e amigável à bateria para o GNOME Shell (48+). Fornece alertas visuais instantâneos, diagnósticos de pressão de memória (PSI), detecção inteligente de vazamentos e gerenciamento ágil de processos diretamente da sua barra superior.

---

## 🌍 Idiomas / Languages
- [Português (Brasil)](#-características-principais)
- [English](#-key-features)

---

## 🇧🇷 Português

### 🚀 Características Principais

* **Integração Nativa com GTop:** Acessa estatísticas de memória física (RAM) e estados de processos diretamente do kernel via bindings C da biblioteca `libgtop`. Elimina totalmente a necessidade de realizar forks pesados de subprocessos (`ps -eo ...`), poupando bateria e CPU.
* **Operações 100% Assíncronas (Non-Blocking I/O):** A leitura de arquivos de sistema (`/proc/pressure/memory`) e a listagem de diretórios ativos do `/proc` utilizam APIs assíncronas do `Gio`, garantindo que a thread principal de renderização do GNOME Shell nunca sofra travamentos (lags).
* **Pressão de Memória (PSI - Pressure Stall Information):** Monitora estatísticas de pressão de memória do kernel Linux em tempo real, informando quando o sistema está sofrendo lentidão por falta de recursos físicos (métricas `some` e `full`).
* **Detector Inteligente de Vazamentos (Leak):** Analisa a variação rápida de consumo de RAM ao longo de intervalos temporais curtos (gradiente de consumo) para alertar visualmente sobre potenciais vazamentos de memória.
* **Top Processos & Ação Rápida (Kill):** Exibe os 3 processos ativos que mais consomem memória física (RSS) no sistema, com um botão seguro de terminação (`kill -15`) que impede a injeção de comandos arbitrários.
* **Internacionalização Dinâmica (Gettext):** Suporte nativo a múltiplos idiomas implementado via Gettext. A extensão detecta e adapta suas mensagens para o português ou inglês automaticamente conforme o idioma do seu sistema operacional.

---

### ⬇️ Instalação a partir do Código Fonte (Clone)

```bash
# 1. Clone o repositório
git clone https://github.com/richardson-souza/mem-alert.git
cd mem-alert

# 2. Compile o arquivo de tradução
msgfmt po/en.po -o locale/en/LC_MESSAGES/mem-alert.mo

# 3. Crie o pacote da extensão
zip -r mem-alert@richardson-souza.github.com.shell-extension.zip \
  extension.js metadata.json prefs.js utils.js locale/ \
  schemas/org.gnome.shell.extensions.mem-alert.gschema.xml

# 4. Instale usando o utilitário oficial do GNOME
gnome-extensions install mem-alert@richardson-souza.github.com.shell-extension.zip --force

# 5. Ative a extensão
gnome-extensions enable mem-alert@richardson-souza.github.com
```
*(Pode ser necessário encerrar a sessão/logout para que o GNOME reconheça a extensão recém-instalada)*

---

### 📂 Estrutura do Projeto

* **`extension.js`**: Gerencia a criação dos elementos gráficos na barra de status do GNOME, menus suspensos, atalhos rápidos e a orquestração cíclica de atualização.
* **`utils.js`**: Módulo isolado contendo lógica de negócio pura (cálculos determinísticos, parsing de strings de kernel, decodificação de bytes C).
* **`prefs.js`**: Configura a interface gráfica moderna das preferências do usuário (`Adw.PreferencesWindow`), permitindo ajustar dinamicamente o limite de alerta de RAM.
* **`tests/`**: Suite de testes automatizados e isolados que validam a lógica pura da extensão usando o interpretador nativo do GNOME (`gjs`).
* **`po/` e `locale/`**: Modelos de internacionalização, mapeamento de traduções (`.po`) e catálogos compilados binários (`.mo`).

---

### 🧪 Suite de Testes Automatizada

A extensão inclui testes robustos que validam o processamento matemático e decodificação C de processos de forma desacoplada da UI do GNOME Shell.

Para executar os testes locais usando o próprio interpretador nativo `gjs`:
```bash
gjs -m tests/run_tests.js
```

**Saída esperada:**
```text
Iniciando testes de unidade do mem-alert...
[PASSOU] Parsing do PSI não deve retornar nulo
[PASSOU] Deve ler a pressão 'some' corretamente
[PASSOU] Deve ler a pressão 'full' corretamente
...
🎉 Todos os testes passaram com sucesso!
```

---

### 🛠️ Empacotamento para Publicação

A extensão segue rigorosamente as diretrizes da EGO (GNOME Shell Extensions) para o empacotamento oficial de versões 45+.

Para compilar e gerar um pacote `.zip` limpo (excluindo temporários de build e schemas pré-compilados redundantes):
```bash
# Compila o catálogo de idiomas Gettext
msgfmt po/en.po -o locale/en/LC_MESSAGES/mem-alert.mo

# Cria o arquivo de empacotamento limpo
zip -r mem-alert@richardson-souza.github.com.shell-extension.zip \
  extension.js metadata.json prefs.js utils.js locale/ \
  schemas/org.gnome.shell.extensions.mem-alert.gschema.xml
```

---

### 🔍 Verificação e Qualidade (Linter)

O pacote `.zip` gerado é submetido à validação rigorosa de ferramentas automatizadas como o **shexli**, garantindo que não existam vazamentos de memória (leaks de GObjects) no ciclo de vida da extensão (`enable()` / `disable()`).

```bash
# Executando a validação
shexli mem-alert@richardson-souza.github.com.shell-extension.zip
```
**Resultado obtido:**
> **`shexli: clean (0 findings, 0 errors, 0 warnings)`** ✨

---

---

## 🇺🇸 English

### 🚀 Key Features

* **Native GTop Bindings:** Directly fetches memory allocations (RAM) and active process resident set size (RSS) via C `libgtop` library bindings. Saves system resources by avoiding heavy process forks (`ps` commands).
* **100% Asynchronous UI & I/O:** Reading PSI descriptors (`/proc/pressure/memory`) and enumerating active processes run asynchronously using Gio, preventing UI rendering freezes or performance lags.
* **Linux PSI Metrics (Pressure Stall Information):** Tracks kernel stall statistics in real time (`some` and `full`), informing you when CPU or I/O is thrashing due to memory shortage.
* **Visual Alarms & Leak Detection:** Features smart coloring based on customizable thresholds. Triggers alert states if RAM rises abruptly over time (leak detection).
* **Top Process Monitor & Safe Killer:** Shows the top 3 RAM-consuming processes, complete with a safe kill button (`SIGTERM`) designed with secure command arguments.
* **Gettext i18n Internationalization:** Ready-to-translate setup utilizing Gettext standards. Adapts UI elements dynamically between English and Portuguese.

---

### ⬇️ Installation from Source (Clone)

```bash
# 1. Clone the repository
git clone https://github.com/richardson-souza/mem-alert.git
cd mem-alert

# 2. Compile translation files
msgfmt po/en.po -o locale/en/LC_MESSAGES/mem-alert.mo

# 3. Package the extension
zip -r mem-alert@richardson-souza.github.com.shell-extension.zip \
  extension.js metadata.json prefs.js utils.js locale/ \
  schemas/org.gnome.shell.extensions.mem-alert.gschema.xml

# 4. Install using the GNOME extensions utility
gnome-extensions install mem-alert@richardson-souza.github.com.shell-extension.zip --force

# 5. Enable the extension
gnome-extensions enable mem-alert@richardson-souza.github.com
```
*(You may need to log out and log back in for GNOME Shell to recognize the newly installed extension)*

---

### 📂 File Structure

* **`extension.js`**: Core extension lifecycle manager. Hooks UI buttons, popup menus, timers, and schedules periodic telemetry polls.
* **`utils.js`**: Decoupled helpers containing pure computations, string parsers, and C-string converters.
* **`prefs.js`**: Renders the modern GTK4/Adw preferences pane where you can customize memory alarm levels.
* **`tests/`**: Native assertions running under standard GJS to guarantee logical correctness of decoupled math functions.
* **`po/` & `locale/`**: Location catalogs, translation templates (`.pot`), and compiled binary translation files (`.mo`).

---

### 🧪 Unit Tests

Run local test suites to verify math and parser behaviors on standard GNOME Javascript Engine:
```bash
gjs -m tests/run_tests.js
```

---

### 🛠️ Production Packaging

Build an optimized `.zip` bundle compliant with GNOME 45+ requirements:
```bash
# Compile translation files
msgfmt po/en.po -o locale/en/LC_MESSAGES/mem-alert.mo

# Package the extension securely
zip -r mem-alert@richardson-souza.github.com.shell-extension.zip \
  extension.js metadata.json prefs.js utils.js locale/ \
  schemas/org.gnome.shell.extensions.mem-alert.gschema.xml
```

---

## 📜 Licença / License

Distribuído sob a licença **GPL-3.0**. Veja o arquivo da licença para mais detalhes.