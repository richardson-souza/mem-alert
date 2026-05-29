import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MemoryAlertPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.mem-alert');

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: _('Configurações de Monitoramento')
        });
        page.add(group);

        const adjustment = new Gtk.Adjustment({
            value: settings.get_int('memory-limit'),
            lower: 1,
            upper: 100,
            step_increment: 1,
            page_increment: 10
        });

        const memoryRow = new Adw.SpinRow({
            title: _('Limite de Alerta (%)'),
            subtitle: _('O texto ficará vermelho ao atingir este valor'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 100,
                step_increment: 1,
                page_increment: 10
            })
        });

        settings.bind(
            'memory-limit',
            memoryRow.adjustment,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        group.add(memoryRow);
        window.add(page);

        memoryRow.connect('changed', () => {
            settings.set_int('memory-limit', memoryRow.get_value());
        });
    }
}