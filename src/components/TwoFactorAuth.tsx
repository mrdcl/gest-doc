import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Key, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { TOTP } from 'otpauth';
import { QRCodeSVG } from 'qrcode.react';

interface TwoFactorAuthProps {
  onClose: () => void;
}

type TFASettings = {
  id: string;
  is_enabled: boolean;
  secret: string | null;
  backup_codes: string[] | null;
  enabled_at: string | null;
};

export default function TwoFactorAuth({ onClose }: TwoFactorAuthProps) {
  const [settings, setSettings] = useState<TFASettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'initial' | 'setup' | 'verify' | 'backup'>('initial');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setSettings(data);
    } catch (error) {
      console.error('Error fetching 2FA settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const totp = new TOTP({
        issuer: 'Gestión Documental',
        label: user.email || 'Usuario',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      const secretKey = totp.secret.base32;
      const otpauthUrl = totp.toString();

      setSecret(secretKey);
      setQrCodeUrl(otpauthUrl);
      setStep('setup');
    } catch (error) {
      console.error('Error starting 2FA setup:', error);
      setError('Error al iniciar configuración');
    }
  };

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Ingresa un código de 6 dígitos');
      return;
    }

    try {
      const totp = new TOTP({
        issuer: 'Gestión Documental',
        label: 'Usuario',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });

      const isValid = totp.validate({ token: verificationCode, window: 1 }) !== null;

      if (!isValid) {
        setError('Código inválido. Por favor intenta nuevamente.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: codesData } = await supabase
        .rpc('generate_backup_codes');

      const codes = codesData || [];

      if (settings) {
        const { error } = await supabase
          .from('user_2fa_settings')
          .update({
            is_enabled: true,
            secret: secret,
            backup_codes: codes,
            enabled_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_2fa_settings')
          .insert({
            user_id: user.id,
            is_enabled: true,
            secret: secret,
            backup_codes: codes,
            enabled_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setBackupCodes(codes);
      setStep('backup');
      setError('');
    } catch (error: any) {
      console.error('Error enabling 2FA:', error);
      setError(error.message || 'Error al verificar código');
    }
  };

  const disable2FA = async () => {
    if (!confirm('¿Estás seguro de desactivar la autenticación de dos factores?\n\nEsto reducirá la seguridad de tu cuenta.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('user_2fa_settings')
        .update({
          is_enabled: false,
          secret: null,
          backup_codes: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      alert('Autenticación de dos factores desactivada');
      await fetchSettings();
      setStep('initial');
    } catch (error: any) {
      console.error('Error disabling 2FA:', error);
      alert('Error al desactivar 2FA');
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadBackupCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'backup-codes-2fa.txt';
    link.click();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="text-gray-500">Cargando configuración...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Autenticación de Dos Factores</h2>
              <p className="text-sm text-gray-500">Protege tu cuenta con un segundo factor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        {step === 'initial' && (
          <div className="space-y-6">
            {settings?.is_enabled ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="text-green-600" size={24} />
                  <div>
                    <h3 className="font-semibold text-green-900">2FA Activado</h3>
                    <p className="text-sm text-green-700">
                      Tu cuenta está protegida con autenticación de dos factores
                    </p>
                  </div>
                </div>
                {settings.enabled_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Activado el: {new Date(settings.enabled_at).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-yellow-600" size={24} />
                  <div>
                    <h3 className="font-semibold text-yellow-900">2FA Desactivado</h3>
                    <p className="text-sm text-yellow-700">
                      Tu cuenta no está protegida con un segundo factor de autenticación
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">¿Qué es 2FA?</h3>
              <p className="text-gray-600">
                La autenticación de dos factores (2FA) agrega una capa adicional de seguridad a tu cuenta.
                Además de tu contraseña, necesitarás un código de 6 dígitos generado por una aplicación
                autenticadora en tu teléfono.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">Aplicaciones recomendadas:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
                <li>1Password</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              {settings?.is_enabled ? (
                <button
                  onClick={disable2FA}
                  className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Desactivar 2FA
                </button>
              ) : (
                <button
                  onClick={startSetup}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Activar 2FA
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Paso 1:</strong> Escanea este código QR con tu aplicación autenticadora
              </p>
            </div>

            <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-gray-200">
              {qrCodeUrl && <QRCodeSVG value={qrCodeUrl} size={200} />}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                O ingresa este código manualmente:
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-4 py-3 rounded font-mono text-sm">
                  {secret}
                </code>
                <button
                  onClick={() => copyToClipboard(secret, -1)}
                  className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="Copiar código"
                >
                  {copiedIndex === -1 ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('verify')}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continuar
              </button>
              <button
                onClick={() => setStep('initial')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Paso 2:</strong> Ingresa el código de 6 dígitos de tu aplicación autenticadora
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de verificación
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(value);
                  setError('');
                }}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500"
                maxLength={6}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={verifyAndEnable}
                disabled={verificationCode.length !== 6}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Verificar y Activar
              </button>
              <button
                onClick={() => setStep('setup')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Atrás
              </button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Check className="text-green-600" size={24} />
                <div>
                  <h3 className="font-semibold text-green-900">¡2FA Activado con éxito!</h3>
                  <p className="text-sm text-green-700">
                    Tu cuenta ahora está protegida con autenticación de dos factores
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Key className="text-yellow-600 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-2">Códigos de Recuperación</h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    Guarda estos códigos en un lugar seguro. Cada código solo puede usarse una vez
                    si pierdes acceso a tu aplicación autenticadora.
                  </p>
                  <div className="bg-white rounded p-3 space-y-2">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="flex items-center justify-between group">
                        <code className="font-mono text-sm">{code}</code>
                        <button
                          onClick={() => copyToClipboard(code, index)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded"
                        >
                          {copiedIndex === index ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadBackupCodes}
                className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Descargar Códigos
              </button>
              <button
                onClick={() => {
                  onClose();
                  fetchSettings();
                }}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Finalizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
