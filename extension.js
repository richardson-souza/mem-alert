import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MemoryAlertExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.mem-alert');
        this._indicator = new PanelMenu.Button(0.5, this.metadata.name, false);

        this._label = new St.Label({
            text: 'RAM: --%',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-label'
        });
        this._indicator.add_child(this._label);

        this._statsItem = new PopupMenu.PopupMenuItem('Calculando...', { reactive: false });
        this._indicator.menu.addMenuItem(this._statsItem);

        this._psiItem = new PopupMenu.PopupMenuItem('Pressão PSI: --', { reactive: false });
        this._psiItem.label.set_style('font-size: 0.85em; opacity: 0.8;');
        this._indicator.menu.addMenuItem(this._psiItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let titleItem = new PopupMenu.PopupMenuItem('Top Processos (RAM):', { reactive: false });
        titleItem.label.set_style('font-weight: bold; font-size: 0.9em; opacity: 0.7;');
        this._indicator.menu.addMenuItem(titleItem);

        this._villains = [];
        for (let i = 0; i < 3; i++) {
            let item = new PopupMenu.PopupBaseMenuItem({ reactive: true });
            let label = new St.Label({ text: '', x_expand: true, y_align: Clutter.ActorAlign.CENTER });
            let killBtn = new St.Button({
                label: 'Kill',
                style_class: 'button',
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                visible: false
            });
            item.add_child(label);
            item.add_child(killBtn);

            item._label = label;
            item._killBtn = killBtn;
            item._pid = null;

            killBtn.connect('clicked', () => {
                if (item._pid) {
                    GLib.spawn_command_line_async(`kill -15 ${item._pid}`);
                }
            });

            this._villains.push(item);
            this._indicator.menu.addMenuItem(item);
        }

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction('Abrir Monitor do Sistema', () => {
            GLib.spawn_command_line_async('gnome-system-monitor');
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
            this._updateMemoryUsage();
            this._updateTopProcesses();
            return GLib.SOURCE_CONTINUE;
        });

        this._lastPercentage = null;
        this._lastTime = Date.now();
    }

    _getPSI() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/pressure/memory');
            if (!ok) return null;
            const text = new TextDecoder().decode(contents);
            const lines = text.split('\n');
            let someMatch = lines[0].match(/avg10=([\d.]+)/);
            let fullMatch = lines[1].match(/avg10=([\d.]+)/);
            return {
                some: someMatch ? parseFloat(someMatch[1]) : 0,
                full: fullMatch ? parseFloat(fullMatch[1]) : 0
            };
        } catch (e) {
            return null;
        }
    }

    _updateMemoryUsage() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/meminfo');
            if (!ok) return;
            const contentString = new TextDecoder().decode(contents);
            const lines = contentString.split('\n');
            let memTotal = 0, memAvailable = 0;
            lines.forEach(line => {
                if (line.startsWith('MemTotal:')) memTotal = parseInt(line.replace(/[^0-9]/g, ''));
                if (line.startsWith('MemAvailable:')) memAvailable = parseInt(line.replace(/[^0-9]/g, ''));
            });

            if (memTotal > 0) {
                let percentage = Math.floor(((memTotal - memAvailable) / memTotal) * 100);
                let currentTime = Date.now();
                let deltaMem = this._lastPercentage !== null ? percentage - this._lastPercentage : 0;
                let deltaTime = (currentTime - this._lastTime) / 1000; // em segundos

                let gradient = deltaTime > 0 ? deltaMem / deltaTime : 0;
                this._lastPercentage = percentage;
                this._lastTime = currentTime;

                let psi = this._getPSI();
                if (psi) {
                    this._psiItem.label.set_text(`Pressão PSI: Some=${psi.some}% Full=${psi.full}%`);
                }

                let labelStyle = 'font-weight: bold;';
                let indicatorStyle = 'border-radius: 4px; margin: 2px 4px; padding: 0 4px;';

                if (gradient > 1.5) { // Vazamento detectado (>1.5% por segundo)
                    this._label.set_text(`LEAK: ${percentage}%`);
                    labelStyle += 'color: white;';
                    indicatorStyle += 'background-color: #9b59b6;'; // Roxo Pulsante (conceito)
                } else {
                    this._label.set_text(`RAM: ${percentage}%`);
                    if (percentage >= 95 || (psi && psi.full > 10)) {
                        labelStyle += 'color: white;';
                        indicatorStyle += 'background-color: #e74c3c;'; // Vermelho Crítico
                    } else if (percentage >= 85 || (psi && psi.some > 20)) {
                        labelStyle += 'color: white;';
                        indicatorStyle += 'background-color: #e67e22;'; // Laranja
                    } else if (percentage >= 70 || (psi && psi.some > 5)) {
                        labelStyle += 'color: rgba(0,0,0,0.8);';
                        indicatorStyle += 'background-color: #f1c40f;'; // Amarelo
                    } else if (percentage >= 60) {
                        labelStyle += 'color: #2ecc71;';
                        indicatorStyle = ''; // Sem fundo especial entre 60-70
                    } else {
                        labelStyle += 'color: #2ecc71;';
                        indicatorStyle = ''; // Verde/Normal
                    }
                }

                this._label.set_style(labelStyle);
                this._indicator.set_style(indicatorStyle);
                let freeGB = (memAvailable / (1024 * 1024)).toFixed(2);
                this._statsItem.label.set_text(`Disponível: ${freeGB} GB`);
            }
        } catch (e) { console.error(e); }
    }

    _updateTopProcesses() {
        try {
            let proc = new Gio.Subprocess({
                argv: ['ps', '-eo', 'pid,comm,%mem,rss', '--sort=-rss', '--no-headers'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE,
            });
            proc.init(null);

            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    let [ok, stdout, stderr] = p.communicate_utf8_finish(res);

                    if (ok && stdout) {
                        let lines = stdout.trim().split('\n').slice(0, 3);

                        this._villains.forEach((item, index) => {
                            if (lines[index]) {
                                let parts = lines[index].trim().split(/\s+/);
                                if (parts.length >= 4) {
                                    let pid = parts[0];
                                    let comm = parts[1];
                                    let memPct = parts[2];
                                    let rssKiB = parseInt(parts[3]);
                                    let rssMiB = (rssKiB / 1024).toFixed(0);

                                    item._pid = pid;
                                    item._label.text = `${comm} (${pid}): ${rssMiB}MB (${memPct}%)`;
                                    item._killBtn.show();
                                    item.show();
                                }
                            } else {
                                item.hide();
                            }
                        });
                    }
                } catch (e) {
                    console.error(`MemAlert Async Error: ${e.message}`);
                }
            });
        } catch (e) {
            console.error(`MemAlert Gio Error: ${e.message}`);
        }
    }

    disable() {
        if (this._timeout) GLib.Source.remove(this._timeout);
        this._indicator.destroy();
        this._settings = null;
    }
}