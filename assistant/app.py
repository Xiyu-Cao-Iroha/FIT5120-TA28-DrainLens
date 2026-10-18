import streamlit as st

from assistant.ai_service import (
    retrieve,
    generate_answer,
    is_emergency,
    is_out_of_scope,
    is_prediction_question,
    is_current_warning_question,
    get_prediction_subject,
    EMERGENCY_RESPONSE,
)


# Streamlit interface

# Configure the Streamlit chatbot page
st.set_page_config(
    page_title="DrainLens Assistant",
    page_icon="🌧️",
    layout="centered"
)

st.markdown(
    """
    <style>

    /* Main page width */
    .block-container {
        max-width: 760px;
        padding-top: 2rem;
        padding-bottom: 6rem;
    }

    /* Hide Streamlit top toolbar */
    header[data-testid="stHeader"] {
        background: transparent;
    }

    /* Main title */
    .chat-title {
        font-size: 28px;
        font-weight: 700;
        color: #17242b;
        margin-bottom: 18px;
    }

    /* Information box */
    .info-box {
        background: #f1f4f3;
        border-radius: 12px;
        padding: 14px 16px;
        color: #5f7078;
        font-size: 15px;
        margin-bottom: 18px;
    }

    /* Small section heading */
    .section-label {
        color: #16735f;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-top: 8px;
        margin-bottom: 10px;
    }

    /* Suggested question buttons */
    div.stButton > button {
        border-radius: 22px;
        border: 1px solid #c5cfcc;
        background: white;
        color: #263238;
        padding: 7px 15px;
        font-size: 14px;
    }

    div.stButton > button:hover {
        border-color: #16735f;
        color: #16735f;
    }

    /* User question bubble */
    .user-bubble {
        background: #177a64;
        color: white;
        padding: 12px 16px;
        border-radius: 18px 18px 4px 18px;
        margin: 18px 0 14px auto;
        width: fit-content;
        max-width: 80%;
        font-size: 15px;
    }

    /* Assistant card */
    .assistant-card {
        background: #f3f5f4;
        border: 1px solid #dde4e1;
        border-radius: 14px;
        padding: 18px;
        margin-top: 10px;
        margin-bottom: 12px;
        font-size: 15px;
        line-height: 1.55;
    }

    /* Source heading */
    .source-label {
        font-size: 13px;
        font-weight: 700;
        color: #66756f;
        margin-top: 14px;
        margin-bottom: 7px;
    }

    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    '<div class="chat-title">Ask about getting ready</div>',
    unsafe_allow_html=True,
)


st.markdown(
    """
    <div class="info-box">
        Answers come from official guides by VICSES,
        Melbourne Water and the City of Melbourne.
        This is not a flood warning.
    </div>
    """,
    unsafe_allow_html=True,
)

with st.chat_message("assistant"):
    st.markdown(
        """
        Hi! I'm your **DrainLens Assistant**.

        I'm here to help you with flood preparation, home safety,
        emergency-kit guidance, and official warning information.

        What can I help you with?
        """
    )

st.markdown(
    '<div class="section-label">SUGGESTED QUESTIONS</div>',
    unsafe_allow_html=True,
)



# Suggested questions for  users

SUGGESTED_QUESTIONS = [
    "How can I prepare my home before flooding?",
    "What should I include in an emergency kit?",
    "How should I prepare drains?",
    "How can I protect important belongings?",
]


# Store the selected suggested question between Streamlit reruns
if "suggested_question" not in st.session_state:
    st.session_state.suggested_question = None

columns = st.columns(2)

for index, suggested_question in enumerate(SUGGESTED_QUESTIONS):
    with columns[index % 2]:
        if st.button(
            suggested_question,
            key=f"suggestion_{index}",
            use_container_width=True
        ):
            st.session_state.suggested_question = suggested_question



# Allow the user to type their own flood-preparation question
typed_question = st.chat_input(
    "Ask your flood-preparation question..."
)

# Use either the typed question or a selected suggested question
question = (
    typed_question
    or st.session_state.suggested_question
)

# Clear the selected question after reading it.
# This prevents it from being submitted again
# on subsequent Streamlit reruns.
st.session_state.suggested_question = None



if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    if message["role"] == "user":
        st.markdown(
            f'<div class="user-bubble">{message["content"]}</div>',
            unsafe_allow_html=True,
        )
    else:
        with st.chat_message("assistant"):
            st.markdown(message["content"])

if question:
    st.session_state.messages.append({
        "role": "user",
        "content": question
    })
    st.markdown(
        f'<div class="user-bubble">{question}</div>',
        unsafe_allow_html=True,
    )

    with st.chat_message("assistant"):
        try:
            if is_emergency(question):
                st.warning(EMERGENCY_RESPONSE)
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": EMERGENCY_RESPONSE
                })    
            elif is_out_of_scope(question):
                answer = (
                    "The available DrainLens official guidance does not provide "
                    "that information."
                )

                st.info(answer)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer
                })   

            elif is_prediction_question(question):
                q = question.lower()

                if "how deep" in q or "floodwater depth" in q:
                    first_sentence = (
                        "DrainLens cannot predict how deep floodwater will be "
                        "at a specific property during a future storm."
                    )
                else:
                    subject = get_prediction_subject(question)
                    first_sentence = (
                        f"DrainLens cannot predict whether a {subject} will flood "
                        "during a future storm."
                    )

                answer = (
                    first_sentence
                    + "\n\n"
                    + "To prepare, you can clear gutters and drains, move valuables "
                    "and appliances to higher ground, keep important documents in "
                    "waterproof storage, and have an emergency kit ready.\n\n"
                    + "For current flood warnings, check VicEmergency."
                )

                st.markdown(answer)
                
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer
                })
            elif is_current_warning_question(question):
                answer = (
                    "For current Victorian flood warnings, check "
                    "[VicEmergency](https://emergency.vic.gov.au/)."
                )

                st.markdown(answer)

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer
                })
            else:
                with st.spinner("Searching official guidance..."):
                    documents = retrieve(question)

                    if not documents:
                        st.warning(
                            "No supporting information was found "
                            "in the available documents."
                        )

                    else:
                        answer = generate_answer(
                            question,
                            documents
                        )

                        st.markdown(answer)
                        
                        st.session_state.messages.append({
                            "role": "assistant",
                            "content": answer
                        })

                        st.divider()
                        st.subheader("Official sources")

                        seen_sources = set()
                        source_number = 1

                        for item in documents:
                            metadata = item["metadata"]

                            title = metadata.get(
                                "title",
                                "Unknown document"
                            )

                            page = metadata.get("page")
                            page_display = page if page is not None else "Unknown"

                            organisation = metadata.get(
                                "organisation",
                                "Unknown"
                            )

                            source_key = (
                                title,
                                organisation
                            )

                            if source_key in seen_sources:
                                continue

                            seen_sources.add(source_key)

                            st.markdown(
                                f"**[Source {source_number}]** "
                                f"{title} — page {page_display}  \n"
                                f"Organisation: {organisation}"
                            )

                            url = metadata.get(
                                "source_url",
                                ""
                            )

                            if url.startswith(
                                ("https://", "http://")
                            ):
                                st.markdown(
                                    f"[Open official document]({url})"
                                )

                            source_number += 1
                            if source_number > 2:
                                break
        # Handle any other unexpected program error
        except Exception as error:
            st.error(
                f"An error occurred: {error}"
            )