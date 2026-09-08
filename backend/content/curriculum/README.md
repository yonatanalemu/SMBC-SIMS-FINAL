# Curriculum Files

Drop a curriculum PDF straight into the matching department/level folder — any
filename is fine, as long as the file itself is a `.pdf`. Multiple PDFs in one
folder are all picked up (e.g. if a level's curriculum spans more than one file).

Folder names are exact matches against the department and level names already
seeded in the database — don't rename or restructure them, or the scanner won't
be able to match a file to the right department/level.

**How it gets picked up:** every time the backend container starts, it scans
this whole folder tree and syncs whatever it finds into the database (adds new
files, removes DB entries for files you've deleted). You don't need to use any
upload form — just add the file and restart the backend
(`docker compose restart backend`), or redeploy.

Once synced, a curriculum shows up automatically for:
- **Students** in that exact department + level
- **Teachers** and **Dept Heads** assigned to that department (they see every
  level in their department, not just one)

## Folder map (already created for you)

```
curriculum/
├── Nursing/{Level 3, Level 4}/
├── Medical Laboratory/{Level 3, Level 4}/
├── Midwifery/{Level 3, Level 4}/
├── Accounting/{Level 2 Terminal, Level 2 Diploma, Level 3, Level 4}/
├── HRM/{Level 2 Terminal, Level 2 Diploma, Level 3, Level 4}/
├── BSc Nursing/{Year I Semester I ... Year IV Semester II}/
├── BSc Human Nutrition/{Year I Semester I ... Year IV Semester II}/
├── BA Business Management/{Year I Semester I ... Year IV Semester II}/
└── BA Accounting & Finance/{Year I Semester I ... Year IV Semester II}/
```
