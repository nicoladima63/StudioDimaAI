import React, { useEffect, useRef } from 'react';
import SlimSelect from 'slim-select';
import 'slim-select/styles' // optional css import method


interface Option {
  value: string;
  text: string;
  selected?: boolean;
  display?: boolean;
  disabled?: boolean;
  placeholder?: boolean;
  data?: {
    [key: string]: string;
  };
}

interface SlimSelectProps {
  options: Option[];
  placeholder?: string;
  onChange?: (selected: string | string[]) => void;
  selected?: string | string[];
  settings?: Partial<SlimSelect['config']>;
}

const SlimSelectComponent: React.FC<SlimSelectProps> = ({
  options,
  placeholder,
  onChange,
  selected,
  settings,
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const slimSelectInstance = useRef<SlimSelect | null>(null);

  useEffect(() => {
    if (selectRef.current) {
      slimSelectInstance.current = new SlimSelect({
        select: selectRef.current,
        placeholder: placeholder,
        data: options,
        onChange: (info) => {
          if (onChange) {
            const selectedValues = Array.isArray(info)
              ? info.map((item) => item.value)
              : info.value;
            onChange(selectedValues);
          }
        },
        ...settings,
      });
    }

    return () => {
      if (slimSelectInstance.current) {
        slimSelectInstance.current.destroy();
      }
    };
  }, [placeholder, onChange, settings]);

  useEffect(() => {
    if (slimSelectInstance.current) {
      slimSelectInstance.current.setData(options);
      if (selected !== undefined) {
        slimSelectInstance.current.setSelected(selected);
      }
    }
  }, [options, selected]);

  return <select ref={selectRef}></select>;
};

export default SlimSelectComponent;
