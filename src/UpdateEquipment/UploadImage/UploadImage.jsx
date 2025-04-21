import './UploadImage.sass';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpFromBracket, faClose, faFloppyDisk, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import imageCompression from "browser-image-compression";

import { useEffect, useRef, useState } from 'react';
const UploadImage = ({ setUpload, setBlur, img, setImg }) => {

    const imgUploadRef = useRef();
    const [imgSrc, setImgSrc] = useState('');
    const [imgName, setImgName] = useState('');
    const [imgBase64, setImgBase64] = useState('');

    const [saveDisabled, setSaveDisabled] = useState(true);
    const [uploadFail, setUploadFail] = useState(false); 

    useEffect(() => {
        if(img.img != null && img.imgName != null) {
            setImgSrc(img.img);
            setImgName(img.imgName);
            setSaveDisabled(false);
        }
        setBlur(true);
    }, []);

    const handleFileUpload = async () => {
        const file = imgUploadRef.current.files[0];

        if(file) {
            if(file.name.split('.').pop() == 'jpg' || file.name.split('.').pop() == 'png' || file.name.split('.').pop() == 'jpeg') {
                const reader = new FileReader();

                const options = {
                    maxSizeMB: 0.08,
                    maxWidthOrHeight: 800,
                    useWebWorker: true
                };
                const compressedImg = await imageCompression(file, options);
                reader.readAsDataURL(compressedImg);

                reader.onloadend = () => {
                    setImgSrc(reader.result);
                    setImgName(file.name);
                    setUploadFail(false);
                    setSaveDisabled(false);
                }
            } else {
                setUploadFail(true);
                setImgSrc(null);
                setImgName(null);
                setSaveDisabled(true);
            }
        }        
    }

    const handleCloseMenu = () => {
        setUpload(false);
        setBlur(false);
    }

    const handleSaveEvent = () => {
        setImg({img: imgSrc, imgName: imgName});
        handleCloseMenu();
    }

    const handleClearEvent = () => {
        setImgSrc(null);
        setImgName(null);
    }

    return (
        <div className="UploadImage">
            <div className="head">
                <h1>Bild hochladen</h1>
                <FontAwesomeIcon className='close' icon={faClose} onClick={handleCloseMenu} />
            </div>

            <div className='form'>
                <div className='options'>
                    <label htmlFor="img-upload"><FontAwesomeIcon icon={faArrowUpFromBracket} /><p>Bild hochladen</p></label>
                    <input ref={imgUploadRef} onChange={handleFileUpload} type="file" name="" id="img-upload" />

                    {imgSrc != '' ? <button onClick={handleClearEvent} className="clear-img"><FontAwesomeIcon icon={faTrashCan} /></button> : null}
                </div>

                {uploadFail ? <p className='upload-fail-text'>Die hochgeladene Datei hat keinen unterstützen Dateitypen (.jpg, .png)</p> : null}
                {imgName != '' ? <p className='img-name'>{imgName}</p> : null}
                {imgSrc != '' ? <img className='img' src={imgSrc} /> : null}
            </div>

            <button className={saveDisabled ? "btn-save disabled" : "btn-save"} onClick={!saveDisabled ? handleSaveEvent : null}><FontAwesomeIcon icon={faFloppyDisk} /> Speichern</button>
        </div>
    );
}

export default UploadImage;