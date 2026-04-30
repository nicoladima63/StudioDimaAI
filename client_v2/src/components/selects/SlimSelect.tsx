import React, { useEffect, useRef } from 'react';
import SlimSelect from 'slim-select';
import 'slim-select/styles';

interface Option {
  value: string;
  text: string;
  selected?: boolean;
  display?: boolean;
  disabled?: boolean;
  placeholder?: boolean;
  data?: { [key: string]: string };
}

interface SlimSelectProps {
  options: Option[];
  placeholder?: string;
  onChange?: (selected: string | string[]) => void;
  selected?: string | string[];
  settings?: object;
}

const SlimSelectComponent: React.FC<SlimSelectProps> = ({
  options,
  placeholder,
  onChange,
  selected,
  settings,
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const instanceRef = useRef<SlimSelect | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!selectRef.current) return;

    instanceRef.current = new SlimSelect({
      select: selectRef.current,
      settings: {
        placeholderText: placeholder ?? '',
        ...(settings ?? {}),
      },
      events: {
        afterChange: (newVal) => {
          if (!onChangeRef.current) return;
          const values = newVal.map((item) => item.value);
          onChangeRef.current(values.length === 1 ? values[0] : values);
        },
      },
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setData(options);
    }
  }, [options]);

  useEffect(() => {
    if (instanceRef.current && selected !== undefined) {
      instanceRef.current.setSelected(selected as string | string[]);
    }
  }, [selected]);

  return <select ref={selectRef} />;
};

export default SlimSelectComponent;
