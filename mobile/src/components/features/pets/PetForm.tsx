import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';

import { birthDateFromAge, ageFromBirthDate } from '@/features/pets/age';
import { usePetDetail } from '@/features/pets/hooks';
import { petsRepo, type PickedImage } from '@/features/pets/repo';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';
import { emptyHealth, type InsuranceStatus, type PetSex, type PetSpecies, type PetTag } from '@/types/pets';

import { Button, Checkbox, ChipSelect, Text, TextField } from '../../ui';
import { FormScreen } from '../FormScreen';
import { PetAvatar } from './PetAvatar';

const SPECIES: PetSpecies[] = ['dog', 'cat', 'other'];
const SEX: PetSex[] = ['male', 'female', 'unknown'];
const TAGS: PetTag[] = ['healthy', 'senior', 'special_needs', 'on_medication'];
const INSURANCE: InsuranceStatus[] = ['unknown', 'none', 'insured'];

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function PetForm({ petId }: { petId?: string }) {
  const { t } = useTranslation('pets');
  const router = useRouter();
  const { profile } = useAuth();
  const { detail, loaded } = usePetDetail(petId);

  const [filled, setFilled] = useState(!petId);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<PetSex>('unknown');
  const [neutered, setNeutered] = useState(false);
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [weight, setWeight] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [behaviour, setBehaviour] = useState('');
  const [feeding, setFeeding] = useState('');
  const [walking, setWalking] = useState('');
  const [quirks, setQuirks] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [medical, setMedical] = useState('');
  const [allergies, setAllergies] = useState('');
  const [chip, setChip] = useState('');
  const [insurance, setInsurance] = useState<InsuranceStatus>('unknown');
  const [insurer, setInsurer] = useState('');
  const [clinic, setClinic] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!detail || filled) return;
    const { pet, health } = detail;
    const age = ageFromBirthDate(pet.birth_date);
    setName(pet.name); setSpecies(pet.species); setBreed(pet.breed ?? ''); setSex(pet.sex); setNeutered(!!pet.is_neutered);
    setYears(age ? String(age.years) : ''); setMonths(age && age.months ? String(age.months) : '');
    setWeight(pet.weight_kg != null ? String(pet.weight_kg) : ''); setTags(pet.tags);
    setBehaviour(pet.behaviour_notes ?? ''); setFeeding(pet.feeding_routine ?? ''); setWalking(pet.walking_routine ?? ''); setQuirks(pet.quirks ?? '');
    setPhotoPath(pet.photo_path);
    setMedical(health.medical_notes ?? ''); setAllergies(health.allergies.join(', ')); setChip(health.microchip_id ?? '');
    setInsurance(health.insurance_status); setInsurer(health.insurance_provider ?? '');
    setClinic(health.vet_clinic ?? ''); setVetName(health.vet_name ?? ''); setVetPhone(health.vet_phone ?? '');
    setFilled(true);
  }, [detail, filled]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setPicked({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' });
  };

  const save = async () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errors.required');
    const w = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (w !== null && (!Number.isFinite(w) || w <= 0 || w >= 200)) next.weight = t('errors.invalidNumber');
    if (profile && chip.trim() && !/^[0-9A-Za-z]{9,15}$/.test(chip.trim())) next.chip = t('errors.invalidNumber');
    setErrors(next);
    if (Object.keys(next).length || !profile) return;

    const y = parseInt(years || '0', 10) || 0;
    const m = parseInt(months || '0', 10) || 0;
    const birth = years || months ? birthDateFromAge(y, m) : (detail?.pet.birth_date ?? null);

    setBusy(true);
    try {
      const id = await petsRepo.savePet(
        profile.id,
        petId ?? null,
        {
          name: name.trim(), species, breed: orNull(breed), sex, is_neutered: sex === 'unknown' ? null : neutered,
          birth_date: birth, weight_kg: w, photo_path: photoPath, tags: tags as PetTag[],
          behaviour_notes: orNull(behaviour), feeding_routine: orNull(feeding), walking_routine: orNull(walking), quirks: orNull(quirks),
        },
        {
          ...emptyHealth,
          microchip_id: orNull(chip), insurance_status: insurance, insurance_provider: orNull(insurer), medical_notes: orNull(medical),
          allergies: allergies.split(',').map((a) => a.trim()).filter(Boolean),
          vet_clinic: orNull(clinic), vet_name: orNull(vetName), vet_phone: orNull(vetPhone),
        },
      );
      if (picked) await petsRepo.uploadPhoto(profile.id, id, picked);
      router.back();
    } catch {
      setErrors({ form: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  const archive = () => {
    if (!petId) return;
    const run = async () => {
      await petsRepo.archivePet(petId);
      router.dismissTo('/owner/pets');
    };
    if (Platform.OS === 'web') void run();
    else Alert.alert(t('form.archive'), t('form.archiveConfirm', { name }), [{ text: t('meds.cancel'), style: 'cancel' }, { text: t('form.archive'), style: 'destructive', onPress: () => void run() }]);
  };

  if (petId && !loaded) return <FormScreen title={t('form.editTitle')}><View /></FormScreen>;

  return (
    <FormScreen
      title={petId ? t('form.editTitle') : t('form.newTitle')}
      footer={<Button label={busy ? t('form.saving') : t('form.save')} onPress={save} loading={busy} />}
    >
      <View style={{ alignItems: 'center', gap: space.md }}>
        <PetAvatar name={name || '?'} photoPath={picked ? picked.uri : photoPath} size={96} />
        <Button variant="ghost" icon="camera" label={picked || photoPath ? t('form.photoChange') : t('form.photoAdd')} onPress={pickPhoto} />
      </View>

      <Text variant="overline" color="accent">{t('form.identity')}</Text>
      <TextField label={t('form.name')} value={name} onChangeText={setName} error={errors.name} />
      <Text variant="caption" color="inkMuted">{t('form.species')}</Text>
      <ChipSelect options={SPECIES.map((s) => ({ value: s, label: t(`species.${s}`) }))} selected={[species]} onChange={(v) => setSpecies(v[0] as PetSpecies)} />
      <TextField label={t('form.breed')} value={breed} onChangeText={setBreed} />
      <Text variant="caption" color="inkMuted">{t('form.sex')}</Text>
      <ChipSelect options={SEX.map((s) => ({ value: s, label: t(`sex.${s}`) }))} selected={[sex]} onChange={(v) => setSex(v[0] as PetSex)} />
      {sex !== 'unknown' ? <Checkbox checked={neutered} onToggle={() => setNeutered((v) => !v)} label={t('form.neutered')} /> : null}
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><TextField label={t('form.ageYears')} value={years} onChangeText={(v) => setYears(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr /></View>
        <View style={{ flex: 1 }}><TextField label={t('form.ageMonths')} value={months} onChangeText={(v) => setMonths(v.replace(/\D/g, ''))} keyboardType="number-pad" ltr /></View>
      </View>
      <TextField label={t('form.weight')} value={weight} onChangeText={setWeight} error={errors.weight} keyboardType="decimal-pad" ltr />
      <Text variant="caption" color="inkMuted">{t('form.status')}</Text>
      <ChipSelect multiple options={TAGS.map((s) => ({ value: s, label: t(`tags.${s}`) }))} selected={tags} onChange={setTags} />

      <Text variant="overline" color="accent" style={{ marginTop: space.md }}>{t('form.routine')}</Text>
      <TextField label={t('form.behaviour')} value={behaviour} onChangeText={setBehaviour} multiline />
      <TextField label={t('form.feeding')} value={feeding} onChangeText={setFeeding} multiline />
      <TextField label={t('form.walking')} value={walking} onChangeText={setWalking} multiline />
      <TextField label={t('form.quirks')} value={quirks} onChangeText={setQuirks} multiline />

      <Text variant="overline" color="accent" style={{ marginTop: space.md }}>{t('form.health')}</Text>
      <Text variant="caption" color="inkFaint">{t('form.healthPrivacy')}</Text>
      <TextField label={t('form.medicalNotes')} value={medical} onChangeText={setMedical} multiline />
      <TextField label={t('form.allergies')} hint={t('form.allergiesHint')} value={allergies} onChangeText={setAllergies} />
      <TextField label={t('form.microchip')} value={chip} onChangeText={setChip} error={errors.chip} ltr autoCapitalize="characters" />
      <Text variant="caption" color="inkMuted">{t('form.insuranceStatus')}</Text>
      <ChipSelect options={INSURANCE.map((s) => ({ value: s, label: t(`insurance.${s}`) }))} selected={[insurance]} onChange={(v) => setInsurance(v[0] as InsuranceStatus)} />
      {insurance === 'insured' ? <TextField label={t('form.insuranceProvider')} value={insurer} onChangeText={setInsurer} /> : null}
      <TextField label={t('form.vetClinic')} value={clinic} onChangeText={setClinic} />
      <TextField label={t('form.vetName')} value={vetName} onChangeText={setVetName} />
      <TextField label={t('form.vetPhone')} value={vetPhone} onChangeText={setVetPhone} ltr keyboardType="phone-pad" />

      {errors.form ? <Text variant="caption" color="danger">{errors.form}</Text> : null}
      {petId ? <Button variant="ghost" label={t('form.archive')} onPress={archive} /> : null}
    </FormScreen>
  );
}
