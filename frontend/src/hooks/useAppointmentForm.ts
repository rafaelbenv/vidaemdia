import { useState } from 'react';
import { NotificationChannel } from '../types';
import { todayStr } from '../lib/format';

export function useAppointmentForm() {
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(() => todayStr);
  const [formTime, setFormTime] = useState('08:00');
  const [formDesc, setFormDesc] = useState('');
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(0);
  const [formChannel, setFormChannel] = useState<NotificationChannel>('TELEGRAM');
  const [dateError, setDateError] = useState<string | null>(null);

  return {
    formTitle,
    setFormTitle,
    formDate,
    setFormDate,
    formTime,
    setFormTime,
    formDesc,
    setFormDesc,
    formReminderMinutes,
    setFormReminderMinutes,
    formChannel,
    setFormChannel,
    dateError,
    setDateError,
  };
}
