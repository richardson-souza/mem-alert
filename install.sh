#!/usr/bin/env bash

set -e

echo "🧠 Installing Memory Alert Monitor extension..."

UUID="mem-alert@richardson-souza.github.com"
ZIP_NAME="${UUID}.shell-extension.zip"
CLONED=false

# 1. GNOME Shell Version Check
echo "🔍 Checking GNOME Shell version..."
if command -v gnome-shell >/dev/null 2>&1; then
    GNOME_VERSION_STR=$(gnome-shell --version)
    GNOME_VERSION=$(echo "$GNOME_VERSION_STR" | awk '{print $3}' | cut -d. -f1)
    
    if [ -z "$GNOME_VERSION" ] || [ "$GNOME_VERSION" -lt 46 ]; then
        echo "❌ Error: GNOME Shell version 46 or higher is required. Found: $GNOME_VERSION_STR"
        exit 1
    else
        echo "✅ Found $GNOME_VERSION_STR (Supported)"
    fi
else
    echo "❌ Error: 'gnome-shell' command not found. Are you running GNOME?"
    exit 1
fi

# 2. Dependency Installer Helper
install_pkg() {
    local DEBIAN_PKG=$1
    local FEDORA_PKG=$2
    local ARCH_PKG=$3

    echo "   sudo permissions may be required to install missing dependencies..."
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y "$DEBIAN_PKG"
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y "$FEDORA_PKG"
    elif command -v zypper >/dev/null 2>&1; then
        sudo zypper install -y "$FEDORA_PKG"
    elif command -v pacman >/dev/null 2>&1; then
        sudo pacman -S --noconfirm "$ARCH_PKG"
    else
        echo "❌ Could not detect package manager to install dependencies automatically."
        echo "   Please manually install equivalent of: $DEBIAN_PKG"
        exit 1
    fi
}

# 3. Check and Install Dependencies
echo "🔍 Checking and installing dependencies..."

if ! command -v zip >/dev/null 2>&1; then
    echo "⚠️ 'zip' is missing. Installing..."
    install_pkg "zip" "zip" "zip"
fi

if ! command -v msgfmt >/dev/null 2>&1; then
    echo "⚠️ 'gettext' (msgfmt) is missing. Installing..."
    install_pkg "gettext" "gettext" "gettext"
fi

if ! command -v gjs >/dev/null 2>&1; then
    echo "⚠️ 'gjs' is missing. Installing..."
    install_pkg "gjs" "gjs" "gjs"
fi

if ! gjs -c "imports.gi.GTop;" >/dev/null 2>&1; then
    echo "⚠️ 'libgtop' GI bindings are missing. Installing..."
    install_pkg "gir1.2-gtop-2.0" "libgtop2" "libgtop"
fi

# 4. Kernel PSI Check
echo "🔍 Checking Kernel PSI (Pressure Stall Information)..."
if [ ! -r "/proc/pressure/memory" ]; then
    echo "⚠️ Warning: /proc/pressure/memory is not readable or missing."
    echo "   The extension requires PSI to monitor memory pressure."
    echo "   You might need to add 'psi=1' to your kernel boot parameters (GRUB)."
else
    echo "✅ Kernel PSI is available."
fi

# 5. Clone repository if needed
if [ ! -f "metadata.json" ] || [ ! -d "schemas" ]; then
    echo "📦 Cloning repository..."
    TMP_DIR=$(mktemp -d)
    git clone https://github.com/richardson-souza/mem-alert.git "$TMP_DIR"
    cd "$TMP_DIR"
    CLONED=true
fi

# 6. Build and Package
echo "🌐 Compiling translations..."
mkdir -p locale/en/LC_MESSAGES
msgfmt po/en.po -o locale/en/LC_MESSAGES/mem-alert.mo

echo "🗜️ Packaging the extension..."
rm -f "$ZIP_NAME"
zip -r -q "$ZIP_NAME" extension.js metadata.json prefs.js utils.js locale/ schemas/org.gnome.shell.extensions.mem-alert.gschema.xml

# 7. Install and Enable
echo "⚙️ Installing the extension via gnome-extensions..."
gnome-extensions install "$ZIP_NAME" --force

echo "🚀 Enabling the extension..."
gnome-extensions enable "$UUID"

if [ "$CLONED" = true ]; then
    echo "🧹 Cleaning up temporary files..."
    cd - > /dev/null
    rm -rf "$TMP_DIR"
fi

echo ""
echo "✅ Installation successfully completed!"
echo "ℹ️ IMPORTANT: You may need to restart your GNOME session for the extension to work."
echo "   - On X11: Press Alt+F2, type 'r', and press Enter."
echo "   - On Wayland: Log out and log back in."
