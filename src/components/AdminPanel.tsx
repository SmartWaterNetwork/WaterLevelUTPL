import React, { useEffect, useState } from 'react';
import { LogOut, MapPin, Plus, ShieldCheck, Trash2, Pencil, PowerOff, Power } from 'lucide-react';
import { StationConfig } from '../types';
import { Auth } from '../hooks/useAuth';
import { StationCatalog } from '../hooks/useStationCatalog';
import {
  StationDraft,
  configToDraft,
  createStation,
  deactivateStation,
  deleteStation,
  saveStation,
} from '../lib/stationsApi';
import { isSupabaseConfigured } from '../lib/supabase';
import { StationForm } from './StationForm';

interface AdminPanelProps {
  auth: Auth;
  catalog: StationCatalog;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="px-5 py-4 border-b border-hairline">
    <h3 className="eyebrow mb-3">{title}</h3>
    {children}
  </section>
);

const inputClass =
  'w-full border border-hairline rounded-md px-2.5 py-1.5 text-[12px] text-ink bg-surface focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink/15';

const Notice: React.FC<{ tone: 'error' | 'info'; children: React.ReactNode }> = ({
  tone,
  children,
}) => (
  <p
    className={`text-[11px] rounded-md px-2.5 py-2 ${
      tone === 'error' ? 'bg-[#fdf3f3] text-crit' : 'bg-tint text-ink-2'
    }`}
    role={tone === 'error' ? 'alert' : undefined}
  >
    {children}
  </p>
);

/** Sign in, sign up, and the one-time claim of the first admin role. */
const AccountBox: React.FC<{ auth: Auth }> = ({ auth }) => {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (auth.session) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-ink truncate">{auth.email}</p>
            <p className="text-[11px] text-ink-3">
              {auth.isLoading
                ? 'Comprobando permisos…'
                : auth.role
                  ? `Rol: ${auth.role}`
                  : 'Sin rol asignado — solo lectura'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 border border-hairline rounded-md hover:text-ink hover:bg-hover shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>

        {auth.canBootstrap && (
          <div className="space-y-2">
            <Notice tone="info">
              La red todavía no tiene administrador. Esta cuenta está autorizada para serlo; es
              una sola vez, después el rol se asigna desde la base de datos.
            </Notice>
            <button
              type="button"
              onClick={() => void auth.claimAdmin()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-white bg-ink rounded-md hover:opacity-90"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Activar esta cuenta como administrador
            </button>
          </div>
        )}

        {auth.error && <Notice tone="error">{auth.error}</Notice>}
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNotice(null);
        if (mode === 'signIn') await auth.signIn(email, password);
        else setNotice(await auth.signUp(email, password));
        setBusy(false);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] text-ink-2 mb-1">Correo</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] text-ink-2 mb-1">Contraseña</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="px-3.5 py-1.5 text-[12px] font-medium text-white bg-ink rounded-md hover:opacity-90 disabled:opacity-40"
        >
          {mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            auth.clearError();
            setNotice(null);
          }}
          className="text-[11px] text-ink-3 hover:text-ink underline underline-offset-2"
        >
          {mode === 'signIn' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
        </button>
      </div>

      {notice && <Notice tone="info">{notice}</Notice>}
      {auth.error && <Notice tone="error">{auth.error}</Notice>}
    </form>
  );
};

const StationRow: React.FC<{
  station: StationConfig;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  busy: boolean;
}> = ({ station, onEdit, onToggleActive, onDelete, busy }) => {
  const inactive = station.isActive === false;

  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 border border-hairline rounded-md ${
        inactive ? 'bg-hover-soft' : 'bg-surface'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink truncate">
          {station.name}
          {inactive && <span className="ml-2 text-[10px] text-ink-3">fuera de servicio</span>}
        </p>
        <p className="text-[11px] text-ink-3 truncate">
          {station.riverName} · canal {station.settings.channelId} ·{' '}
          <span className="tabular-nums">
            {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          title="Editar"
          aria-label={`Editar ${station.name}`}
          className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-tint disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy}
          title={inactive ? 'Volver a poner en servicio' : 'Dar de baja'}
          aria-label={`${inactive ? 'Reactivar' : 'Dar de baja'} ${station.name}`}
          className="p-1.5 rounded-md text-ink-3 hover:text-ink hover:bg-tint disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          {inactive ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Eliminar definitivamente"
          aria-label={`Eliminar ${station.name}`}
          className="p-1.5 rounded-md text-ink-3 hover:text-crit hover:bg-[#fdf3f3] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
};

/**
 * Administration: who you are, and the stations you may change.
 *
 * Every write here is also refused by the database if the role is wrong — the
 * panel hides what you cannot do, row-level security is what stops you doing
 * it. Hiding a button is a courtesy, not a control.
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({ auth, catalog }) => {
  const [editing, setEditing] = useState<{ draft: StationDraft; dbId: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Close the form if the station behind it disappears from the catalogue.
  useEffect(() => {
    if (editing?.dbId && !catalog.allStations.some((s) => s.dbId === editing.dbId)) {
      setEditing(null);
    }
  }, [catalog.allStations, editing]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await catalog.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="px-5 py-4">
        <Notice tone="info">
          La aplicación no está conectada a Supabase, así que las estaciones son las del archivo{' '}
          <code>src/stations.ts</code> y no se pueden editar desde aquí. Añade{' '}
          <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> al archivo{' '}
          <code>.env</code> para gestionarlas.
        </Notice>
      </div>
    );
  }

  if (editing) {
    return (
      <StationForm
        // Remount on a different station so the form never keeps the last one's
        // half-typed values.
        key={editing.dbId ?? 'new'}
        draft={editing.draft}
        isNew={editing.dbId === null}
        busy={busy}
        error={error}
        neighbours={catalog.allStations
          .filter((s) => s.dbId !== editing.dbId)
          .map((s) => ({ lat: s.lat, lng: s.lng }))}
        onCancel={() => {
          setEditing(null);
          setError(null);
        }}
        onSave={async (draft) => {
          await run(async () => {
            if (editing.dbId === null) await createStation(draft);
            else await saveStation(editing.dbId, draft);
          });
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div>
      <Section title="Cuenta">
        <AccountBox auth={auth} />
      </Section>

      <Section title="Estaciones">
        {!auth.isAdmin ? (
          <Notice tone="info">
            {auth.session
              ? 'Tu cuenta no tiene el rol de administrador, así que la lista es de solo lectura.'
              : 'Entra con una cuenta de administrador para dar de alta o modificar estaciones.'}
          </Notice>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing({ draft: emptyDraft(catalog.allStations), dbId: null });
            }}
            className="flex items-center gap-1.5 mb-3 px-3.5 py-1.5 text-[12px] font-medium text-white bg-ink rounded-md hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva estación
          </button>
        )}

        {error && (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {catalog.allStations.length === 0 ? (
          <p className="text-[12px] text-ink-3">
            {catalog.isLoading ? 'Cargando…' : 'Todavía no hay estaciones dadas de alta.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {catalog.allStations.map((station) =>
              confirmingDelete === station.id ? (
                <li
                  key={station.id}
                  className="px-3 py-2.5 border border-[#f2d5d5] bg-[#fdf3f3] rounded-md"
                >
                  <p className="text-[11px] text-ink mb-2">
                    Eliminar <strong>{station.name}</strong> borra también su historial de
                    incidentes. Para retirarla del mapa conservando lo medido, mejor darla de baja.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (station.dbId) await run(() => deleteStation(station.dbId!));
                        setConfirmingDelete(null);
                      }}
                      className="px-3 py-1.5 text-[11px] font-medium text-white bg-crit rounded-md hover:opacity-90 disabled:opacity-40"
                    >
                      Eliminar definitivamente
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className="px-3 py-1.5 text-[11px] text-ink-2 border border-hairline rounded-md hover:text-ink bg-surface"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ) : (
                <StationRow
                  key={station.id}
                  station={station}
                  busy={busy || !auth.isAdmin}
                  onEdit={() => {
                    setError(null);
                    setEditing({ draft: configToDraft(station), dbId: station.dbId ?? null });
                  }}
                  onToggleActive={() =>
                    void run(async () => {
                      if (!station.dbId) return;
                      if (station.isActive === false) {
                        await saveStation(station.dbId, {
                          ...configToDraft(station),
                          isActive: true,
                        });
                      } else {
                        await deactivateStation(station.dbId);
                      }
                    })
                  }
                  onDelete={() => setConfirmingDelete(station.id)}
                />
              )
            )}
          </ul>
        )}
      </Section>

      <Section title="Origen de los datos">
        <p className="text-[11px] text-ink-3 leading-relaxed">
          {catalog.source === 'supabase' ? (
            <>
              <MapPin className="inline w-3 h-3 mr-1 -mt-0.5" />
              Las estaciones se leen de la base de datos y su posición está georreferenciada con
              PostGIS. Las claves de lectura de ThingSpeak no salen del servidor: la telemetría
              pasa por la función <code>station-feed</code>.
            </>
          ) : (
            <>
              No se pudo leer el catálogo, así que se está mostrando la lista incluida en el
              código. {catalog.error}
            </>
          )}
        </p>
      </Section>
    </div>
  );
};

/** A new station, pre-filled with the network's usual values. */
function emptyDraft(existing: StationConfig[]): StationDraft {
  // Count up past whatever is taken: codes are unique in the database, and a
  // deleted station would otherwise hand out a code that already exists.
  const taken = new Set(existing.map((s) => s.id));
  let n = existing.length + 1;
  while (taken.has(`st-${n}`)) n++;

  return {
    code: `st-${n}`,
    name: `Estación ${String(n).padStart(2, '0')}`,
    riverName: '',
    locationLabel: '',
    lat: -4.0,
    lng: -79.2035,
    precaucionCm: 58,
    alertaCm: 70,
    isActive: true,
    channelId: '',
    readApiKey: '',
    settings: {
      channelId: 0,
      resultsCount: 120,
      autoRefreshInterval: 30,
      installationHeight: 100,
      sensorMaterial: 'PP',
      communicationType: '4-20mA',
      levelUnit: 'cm',
      flowUnit: 'L/s',
      conversionMode: 'MANNING',
      channelWidth: 0.5,
      channelSlope: 0.002,
      manningN: 0.013,
      linearFactor: 2.5,
    },
  };
}
