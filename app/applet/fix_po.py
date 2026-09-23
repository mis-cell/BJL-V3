path = "src/pages/PurchaseOrder.tsx"
with open(path, "r") as f:
    text = f.read()

import re
pattern = r"setCalcData\(\s*\{\s*total_lorries:\s*formData\.total_no_of_lorries\s*\|\|\s*'0',\s*units_per_lorry:\s*formData\.units_per_lorry\s*\|\|\s*'0',\s*weight_per_lorry:\s*formData\.weight_per_lorry\s*\|\|\s*'0'\s*\}\s*\)"

match = re.search(pattern, text)
if match:
    replacement = "setCalcData({\n                              total_lorries: formData.total_no_of_lorries || '0',\n                              units_per_lorry: formData.units_per_lorry || '0',\n                              total_units: formData.total_units || '0',\n                              weight_per_lorry: formData.weight_per_lorry || '0'\n                           } as any)"
    text = text[:match.start()] + replacement + text[match.end():]
    with open(path, "w") as f:
        f.write(text)
    print("REPLACED REGEX SUCCESS")
else:
    print("REGEX NOT FOUND")
