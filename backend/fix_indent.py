import sys

with open('app/agent/api.py', 'r') as f:
    lines = f.readlines()

out_lines = []
skip_indent = 0
for line in lines:
    stripped = line.lstrip()
    # Check if this line is exactly "try:\n" or "try:" but with 4 spaces indent.
    if line.startswith('    try:\n') or line.startswith('    try:'):
        # We found the try block we want to remove
        continue
    
    # Check if this line is indented under the try block (8 spaces or more)
    # Actually wait, some parts might be 8 spaces but NOT under the try block we removed?
    # Both try blocks are at indent level 4.
    if line.startswith('        '):
        # unindent by 4 spaces
        out_lines.append(line[4:])
    elif line.startswith('    ') and not line.strip() == '':
        out_lines.append(line)
    else:
        out_lines.append(line)

with open('app/agent/api.py', 'w') as f:
    f.writelines(out_lines)
