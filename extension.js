import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GTop from 'gi://GTop';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { parsePSI, calculateMemoryPercentage, decodeCmd } from './utils.js';

/**
 * MemoryAlertExtension for GNOME Shell.
 * Provides real-time RAM usage monitoring on the top panel bar,
 * customizable visual alerts, memory pressure information (PSI),
 * and shortcuts to view/terminate high-memory processes.
 */
export default class MemoryAlertExtension extends Extension {
    /**
     * Initializes extension resources when enabled.
     * Sets up the panel button UI, drop-down menus, event connections,
     * and initializes the recurring monitoring cycle.
     */
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.mem-alert');
        this._indicator = new PanelMenu.Button(0.5, this.metadata.name, false);

        this._label = new St.Label({
            text: 'RAM: --%',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'panel-label'
        });
        this._indicator.add_child(this._label);

        this._statsItem = new PopupMenu.PopupMenuItem(_('Calculando...'), { reactive: false });
        this._indicator.menu.addMenuItem(this._statsItem);

        this._psiItem = new PopupMenu.PopupMenuItem(_('Pressão PSI: --'), { reactive: false });
        this._psiItem.label.set_style('font-size: 0.85em; opacity: 0.8;');
        this._indicator.menu.addMenuItem(this._psiItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let titleItem = new PopupMenu.PopupMenuItem(_('Top Processos (RAM):'), { reactive: false });
        titleItem.label.set_style('font-weight: bold; font-size: 0.9em; opacity: 0.7;');
        this._indicator.menu.addMenuItem(titleItem);

        this._villains = [];
        for (let i = 0; i < 3; i++) {
            let item = new PopupMenu.PopupBaseMenuItem({ reactive: true });
            let label = new St.Label({ text: '', x_expand: true, y_align: Clutter.ActorAlign.CENTER });
            let killBtn = new St.Button({
                label: _('Kill'),
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
                    try {
                        let proc = new Gio.Subprocess({
                            argv: ['kill', '-15', item._pid.toString()]
                        });
                        proc.init(null);
                        proc.wait_async(null, null);
                    } catch (e) {
                        console.error(`MemAlert Kill Error: ${e.message}`);
                    }
                }
            });

            this._villains.push(item);
            this._indicator.menu.addMenuItem(item);
        }

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction(_('Abrir Monitor do Sistema'), () => {
            try {
                let appInfo = Gio.DesktopAppInfo.new('gnome-system-monitor.desktop');
                if (appInfo) {
                    appInfo.launch(null, null);
                } else {
                    let proc = new Gio.Subprocess({
                        argv: ['gnome-system-monitor']
                    });
                    proc.init(null);
                    proc.wait_async(null, null);
                }
            } catch (e) {
                console.error(`MemAlert Open Monitor Error: ${e.message}`);
            }
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._lastPercentage = null;
        this._lastTime = Date.now();
        this._isUpdating = false;

        this._updateLoop();

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
            this._updateLoop();
            return GLib.SOURCE_CONTINUE;
        });
    }

    /**
     * Async orchestrator invoked every 3 seconds.
     * Ensures strict sequential execution of RAM and top process updates,
     * preventing UI thread rendering concurrency issues.
     *
     * @async
     */
    async _updateLoop() {
        if (this._isUpdating) return;
        this._isUpdating = true;
        try {
            await this._updateMemoryUsage();
            await this._updateTopProcesses();
        } catch (e) {
            console.error(`MemAlert Loop Error: ${e.message}`);
        } finally {
            this._isUpdating = false;
        }
    }

    /**
     * Asynchronously and non-blockingly retrieves memory Pressure Stall Information (PSI)
     * directly from the kernel file '/proc/pressure/memory'.
     *
     * @async
     * @returns {Promise<{some: number, full: number}|null>} Object containing avg10 pressure stats, or null if it fails.
     */
    async _getPSI() {
        try {
            let file = Gio.File.new_for_path('/proc/pressure/memory');
            let [success, contents] = await new Promise((resolve, reject) => {
                file.load_contents_async(null, (obj, res) => {
                    try {
                        resolve(obj.load_contents_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            if (!success) return null;
            return parsePSI(contents);
        } catch (e) {
            return null;
        }
    }

    /**
     * Updates RAM general stats on the top bar and dropdown menu.
     * Leverages native C GTop bindings for negligible CPU overhead.
     * Dynamically reads user settings for visual threshold coloring
     * and detects sudden consumption increases (rapid memory leak detection).
     *
     * @async
     */
    async _updateMemoryUsage() {
        try {
            let mem = new GTop.glibtop_mem();
            GTop.glibtop_get_mem(mem);

            if (mem.total > 0) {
                let percentage = calculateMemoryPercentage(mem.total, mem.free, mem.cached, mem.buffer);

                let currentTime = Date.now();
                let deltaMem = this._lastPercentage !== null ? percentage - this._lastPercentage : 0;
                let deltaTime = (currentTime - this._lastTime) / 1000;

                let gradient = deltaTime > 0 ? deltaMem / deltaTime : 0;
                this._lastPercentage = percentage;
                this._lastTime = currentTime;

                let psi = await this._getPSI();
                if (psi) {
                    this._psiItem.label.set_text(_('Pressão PSI: Some=') + psi.some + '% ' + _('Full=') + psi.full + '%');
                }

                let labelStyle = 'font-weight: bold;';
                let indicatorStyle = 'border-radius: 4px; margin: 2px 4px; padding: 0 4px;';

                let memoryLimit = this._settings.get_int('memory-limit');
                if (memoryLimit <= 0 || memoryLimit > 100) memoryLimit = 85;

                if (gradient > 1.5) {
                    this._label.set_text(_('LEAK: ') + percentage + '%');
                    labelStyle += 'color: white;';
                    indicatorStyle += 'background-color: #9b59b6;';
                } else {
                    this._label.set_text(_('RAM: ') + percentage + '%');
                    if (percentage >= memoryLimit || (psi && psi.full > 10)) {
                        labelStyle += 'color: white;';
                        indicatorStyle += 'background-color: #e74c3c;';
                    } else if (percentage >= (memoryLimit - 10) || (psi && psi.some > 20)) {
                        labelStyle += 'color: white;';
                        indicatorStyle += 'background-color: #e67e22;';
                    } else if (percentage >= (memoryLimit - 20) || (psi && psi.some > 5)) {
                        labelStyle += 'color: rgba(0,0,0,0.8);';
                        indicatorStyle += 'background-color: #f1c40f;';
                    } else if (percentage >= 60) {
                        labelStyle += 'color: #2ecc71;';
                        indicatorStyle = '';
                    } else {
                        labelStyle += 'color: #2ecc71;';
                        indicatorStyle = '';
                    }
                }

                this._label.set_style(labelStyle);
                this._indicator.set_style(indicatorStyle);
                let availableGB = ((mem.free + mem.cached + mem.buffer) / (1024 * 1024 * 1024)).toFixed(2);
                this._statsItem.label.set_text(_('Disponível: ') + availableGB + ' GB');
            }
        } catch (e) {
            console.error(`MemAlert RAM Update Error: ${e.message}`);
        }
    }

    /**
     * Lists the top 3 active processes with highest physical memory (RSS) usage.
     * Enumerates '/proc' asynchronously and queries process metrics using GTop bindings,
     * avoiding system forks to significantly save battery and CPU cycles.
     *
     * @async
     */
    async _updateTopProcesses() {
        try {
            let procDir = Gio.File.new_for_path('/proc');
            let enumerator = await new Promise((resolve, reject) => {
                procDir.enumerate_children_async(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (obj, res) => {
                        try {
                            resolve(obj.enumerate_children_finish(res));
                        } catch (e) {
                            reject(e);
                        }
                    }
                );
            });

            let pids = [];
            let infos;
            while (true) {
                infos = await new Promise((resolve, reject) => {
                    enumerator.next_files_async(
                        100,
                        GLib.PRIORITY_DEFAULT,
                        null,
                        (obj, res) => {
                            try {
                                resolve(obj.next_files_finish(res));
                            } catch (e) {
                                reject(e);
                            }
                        }
                    );
                });
                if (!infos || infos.length === 0) break;

                for (let info of infos) {
                    let name = info.get_name();
                    if (/^\d+$/.test(name)) {
                        pids.push(parseInt(name));
                    }
                }
            }

            await new Promise((resolve, reject) => {
                enumerator.close_async(GLib.PRIORITY_DEFAULT, null, (obj, res) => {
                    try {
                        resolve(obj.close_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            let processList = [];
            for (let pid of pids) {
                try {
                    let procMem = new GTop.glibtop_proc_mem();
                    GTop.glibtop_get_proc_mem(procMem, pid);

                    let procState = new GTop.glibtop_proc_state();
                    GTop.glibtop_get_proc_state(procState, pid);

                    if (procState.cmd && procMem.resident > 0) {
                        let cmdString = decodeCmd(procState.cmd);

                        if (cmdString) {
                            processList.push({
                                pid: pid,
                                cmd: cmdString,
                                rss: procMem.resident
                            });
                        }
                    }
                } catch (e) {
                    // PIDs inativos/protegidos pulam silenciosamente
                }
            }

            processList.sort((a, b) => b.rss - a.rss);
            let top3 = processList.slice(0, 3);

            this._villains.forEach((item, index) => {
                if (top3[index]) {
                    let p = top3[index];
                    let rssMiB = (p.rss / (1024 * 1024)).toFixed(0);
                    item._pid = p.pid;
                    item._label.text = `${p.cmd} (${p.pid}): ${rssMiB}MB`;
                    item._killBtn.show();
                    item.show();
                } else {
                    item.hide();
                }
            });
        } catch (e) {
            console.error(`MemAlert Processes Update Error: ${e.message}`);
        }
    }

    /**
     * Cleans up all system timers, destroys active UI indicators,
     * and clears settings objects when the extension is disabled by GNOME Shell.
     */
    disable() {
        if (this._timeout) {
            GLib.Source.remove(this._timeout);
            this._timeout = null;
        }

        if (this._label) {
            this._label.destroy();
            this._label = null;
        }

        if (this._statsItem) {
            this._statsItem.destroy();
            this._statsItem = null;
        }

        if (this._psiItem) {
            this._psiItem.destroy();
            this._psiItem = null;
        }

        if (this._villains) {
            this._villains.forEach(item => {
                if (item._killBtn) {
                    item._killBtn.destroy();
                    item._killBtn = null;
                }
                if (item._label) {
                    item._label.destroy();
                    item._label = null;
                }
                item.destroy();
            });
            this._villains = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}