# SlimSelect Component

This component is a reusable `select` component built with `slim-select` library.

## Usage

```typescript jsx
import React, { useState } from 'react';
import SlimSelectComponent from './SlimSelect';

const MyForm = () => {
  const [selectedValue, setSelectedValue] = useState<string | string[]>('');

  const options = [
    { value: '1', text: 'Option 1' },
    { value: '2', text: 'Option 2' },
    { value: '3', text: 'Option 3' },
  ];

  const handleChange = (value: string | string[]) => {
    setSelectedValue(value);
    console.log('Selected:', value);
  };

  return (
    <div>
      <label htmlFor="my-select">Select an option:</label>
      <SlimSelectComponent
        options={options}
        placeholder="Select an item"
        onChange={handleChange}
        selected={selectedValue}
        settings={{
          // SlimSelect settings, e.g.,
          // is
          // showSearch: false,
          // allowDeselect: true,
        }}
      />
      <p>Current selection: {Array.isArray(selectedValue) ? selectedValue.join(', ') : selectedValue}</p>
    </div>
  );
};

export default MyForm;
```

## Props

- `options`: An array of objects, where each object represents an option.
  - `value`: The value of the option.
  - `text`: The display text of the option.
  - `selected` (optional): Boolean indicating if the option is pre-selected.
  - `display` (optional): Boolean indicating if the option should be displayed.
  - `disabled` (optional): Boolean indicating if the option is disabled.
  - `placeholder` (optional): Boolean indicating if the option is a placeholder.
  - `data` (optional): An object for custom data attributes.
- `placeholder` (optional): A string to display as the placeholder text when no option is selected.
- `onChange` (optional): A callback function that is called when the selection changes. It receives the selected value(s) as an argument (`string` for single select, `string[]` for multiple select).
- `selected` (optional): The currently selected value(s) to control the component externally. Can be a `string` or `string[]`.
- `settings` (optional): An object to pass any additional `slim-select` configuration options. Refer to the `slim-select` documentation for available settings.
