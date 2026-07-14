import os
import sys
import json
import re
import zipfile
import xml.etree.ElementTree as ET

def extract_text_from_docx(file_path):
    try:
        paragraphs = []
        with zipfile.ZipFile(file_path) as z:
            xml_content = z.read('word/document.xml')
            root = ET.fromstring(xml_content)
            for elem in root.iter():
                tag = elem.tag
                if tag.endswith('}p'):
                    p_text = []
                    for child in elem.iter():
                        if child.tag.endswith('}t') and child.text:
                            p_text.append(child.text)
                    p_str = "".join(p_text).strip()
                    if p_str:
                        paragraphs.append(p_str)
        return '\n'.join(paragraphs)
    except Exception as e:
        print(f"Error reading docx: {e}", file=sys.stderr)
        raise e

def extract_text_from_txt(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading txt: {e}", file=sys.stderr)
        raise e

def parse_questions_fallback(text, default_subject="General"):
    # Normalize line endings
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Split text into logical question blocks.
    # Look for patterns like:
    # - "1.", "2)", "10 -" at the start of a line
    # - "Question 1", "Q1", "Q.1", "Question.1"
    # - Empty lines followed by numbered lists
    pattern = r'\n+(?=(?:\d+[\.\)\s\-]+|[Qq]uestion\s*\d+|[Qq]\d+[\.\s\:\-]*|[Qq]\.\s*\d+))'
    blocks = re.split(pattern, '\n' + text)
    
    questions = []
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
            
        lines = [line.strip() for line in block.split('\n') if line.strip()]
        if not lines:
            continue
            
        # Parse text, options, correct answers, explanation, and numerical answers
        q_text_parts = []
        options = []
        correct_index = -1
        numerical_val = ""
        q_type = "single"  # default
        explanation = ""
        
        # Regexes for parsing
        option_pattern = r'^[\(\[\s]*([A-Da-d])[\.\)\s\]\-]+(.*)$'
        answer_pattern = r'^(?:[Aa]nswer|[Cc]orrect(?:\s+[Aa]nswer)?|[Aa]ns)\s*[:\-\=\s]+(.*)$'
        explanation_pattern = r'^(?:[Ee]xplanation|[Rr]eason|[Ss]olution)\s*[:\-\=\s]+(.*)$'
        
        # We read line by line to determine the structure of the block
        parsing_options = False
        
        for line in lines:
            # Check if it is a correct answer declaration line
            ans_match = re.match(answer_pattern, line, re.IGNORECASE)
            # Check if it is an explanation line
            exp_match = re.match(explanation_pattern, line, re.IGNORECASE)
            # Check if it is an option line
            opt_match = re.match(option_pattern, line)
            
            if ans_match:
                ans_str = ans_match.group(1).strip()
                # Clean up any trailing periods/brackets from answer, e.g. "B)" or "A."
                ans_clean = re.sub(r'[\.\)\s\]\-]+', '', ans_str).strip().upper()
                if ans_clean in ['A', 'B', 'C', 'D']:
                    correct_index = ord(ans_clean) - ord('A')
                elif ans_clean in ['1', '2', '3', '4'] and len(ans_clean) == 1:
                    correct_index = int(ans_clean) - 1
                else:
                    numerical_val = ans_str
                    q_type = "numerical"
                    correct_index = -1
            elif exp_match:
                explanation = exp_match.group(1).strip()
            elif opt_match:
                parsing_options = True
                option_letter = opt_match.group(1).upper()
                option_text = opt_match.group(2).strip()
                options.append(option_text)
            else:
                # If we're already parsing options, text shouldn't be added to question text, but rather appended to the last option if it's a multiline option, or parsed as text.
                if parsing_options and options:
                    # Append to last option if it looks like a continuation
                    options[-1] = options[-1] + " " + line
                else:
                    q_text_parts.append(line)
        
        # Construct the final question text
        q_text = " ".join(q_text_parts)
        # Strip question numbers from start
        q_text = re.sub(r'^\d+[\.\)\s\-]+', '', q_text)
        q_text = re.sub(r'^[Qq]uestion\s*\d+[\.\s\:\-]+', '', q_text, flags=re.IGNORECASE)
        q_text = re.sub(r'^[Qq]\d+[\.\s\:\-]+', '', q_text, flags=re.IGNORECASE)
        q_text = q_text.strip()
        
        if not q_text:
            continue

        # Adjust and format options / types
        if len(options) > 0:
            q_type = "single"
            # Ensure we have exactly 4 options by padding or slicing
            while len(options) < 4:
                options.append(f"Option {len(options) + 1}")
            options = options[:4]
            if correct_index == -1:
                # Default to first option if no valid answer found
                correct_index = 0
        else:
            # Check if numerical answer is present
            if numerical_val:
                q_type = "numerical"
                correct_index = -1
            else:
                # Fallback to single/MCQ if nothing is specified
                q_type = "single"
                options = ["Option A", "Option B", "Option C", "Option D"]
                correct_index = 0

        questions.append({
            "text": q_text,
            "options": options if q_type == "single" else [],
            "correctAnswerIndex": correct_index,
            "type": q_type,
            "numericalAnswer": numerical_val,
            "explanation": explanation,
            "marks": 4,
            "subject": default_subject
        })
        
    return questions

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing required arguments. Usage: python docx_parser.py <file_path> <exam_id> [subject]"}))
        return

    file_path = sys.argv[1]
    exam_id = sys.argv[2]
    subject = sys.argv[3] if len(sys.argv) > 3 else "General"

    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File path does not exist: {file_path}"}))
        return

    # Extract plain text depending on file type
    if file_path.lower().endswith('.docx'):
        text = extract_text_from_docx(file_path)
    else:
        text = extract_text_from_txt(file_path)

    if not text.strip():
        print(json.dumps({"success": False, "error": "Extracted document text is empty."}))
        return

    # Pure Python Pattern Extraction (No Gemini calls, completely offline/deterministic)
    questions = parse_questions_fallback(text, subject)

    if not questions:
        print(json.dumps({"success": False, "error": "Failed to parse questions from the document content."}))
        return

    print(json.dumps({
        "success": True,
        "questions": questions
    }))

if __name__ == "__main__":
    main()
