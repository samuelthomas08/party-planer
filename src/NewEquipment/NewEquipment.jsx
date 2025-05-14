import { useEffect, useRef, useState } from 'react';
import Header from '../Header/Header';
import './NewEquipment.sass';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFloppyDisk, faPlus, faArrowUpFromBracket, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import UploadImage from './UploadImage/UploadImage';
import { db } from '../firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { uid } from 'uid';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../Footer/Footer';

const NewEquipment = () => {

    const navigate = useNavigate();

    const titleRef = useRef('');
    const descriptionRef = useRef('');

    const [selectedCategory, setSelectedCategory] = useState(0);
    const [blur, setBlur] = useState(false);

    const [topBarAddUpload, setTopBarAddUpload] = useState(false);
    const [topBarUpload, setTopBarUpload] = useState(false);
    const [footUpload, setFootUpload] = useState(false);
    const [light01Upload, setLight01Upload] = useState(false);
    const [light02Upload, setLight02Upload] = useState(false);
    const [light03Upload, setLight03Upload] = useState(false);
    const [light04Upload, setLight04Upload] = useState(false);
    const [light05Upload, setLight05Upload] = useState(false);

    const [otherCategoryUpload, setOtherCategoryUpload] = useState(false);

    const [topBarAddData, setTopBarAddData] = useState({img: null, imgName: null});
    const [topBarData, setTopBarData] = useState({img: null, imgName: null});
    const [footData, setFootData] = useState({img: null, imgName: null});
    const [light01Data, setLight01Data] = useState({img: null, imgName: null});
    const [light02Data, setLight02Data] = useState({img: null, imgName: null});
    const [light03Data, setLight03Data] = useState({img: null, imgName: null});
    const [light04Data, setLight04Data] = useState({img: null, imgName: null});
    const [light05Data, setLight05Data] = useState({img: null, imgName: null});

    const [otherCategoryData, setOtherCategoryData] = useState({img: null, imgName: null});

    const showTopBarAdd = topBarAddData.img != null && topBarAddData.imgName != null;
    const showTopBar = topBarData.img != null && topBarData.imgName != null;
    const showFoot = footData.img != null && footData.imgName != null;
    const showLight01 = light01Data.img != null && light01Data.imgName != null;
    const showLight02 = light02Data.img != null && light02Data.imgName != null;
    const showLight03 = light03Data.img != null && light03Data.imgName != null;
    const showLight04 = light04Data.img != null && light04Data.imgName != null;
    const showLight05 = light05Data.img != null && light05Data.imgName != null;

    const [titleRefMissing, setTitleRefMissing] = useState(false);
    const [topBarAddMissing, setTopBarAddMissing] = useState(false);
    const [topBarMissing, setTopBarMissing] = useState(false);
    const [footMissing, setFootMissing] = useState(false);
    const [light01Missing, setLight01Missing] = useState(false);
    const [light02Missing, setLight02Missing] = useState(false);
    const [light03Missing, setLight03Missing] = useState(false);
    const [light04Missing, setLight04Missing] = useState(false);
    const [light05Missing, setLight05Missing] = useState(false);

    const [otherCategoryMissing, setOtherCategoryMissing] = useState(false);

    const showOtherCategory = otherCategoryData.img != null && otherCategoryData.imgName != null;

    const checkFilledForm = () => {
        let statement = false;
        
        console.log('titleRef: ' + titleRef.current.value == '')
        if(titleRef.current.value == '') {
            setTitleRefMissing(true);
        } else {
            setTitleRefMissing(false);
        }

        if (selectedCategory == 1) {
            
            if(otherCategoryData != {img: null, imgName: null}) {
                setOtherCategoryMissing(true);
            } else if (otherCategoryData == {img: null, imgName: null}) {
                setOtherCategoryMissing(false);
            }

            console.log(`titleRef: ${titleRefMissing}`);
            console.log(`otherCategory: ${otherCategoryMissing}`);

            statement = titleRefMissing && otherCategoryMissing;
        }
        
        console.log(statement);
        if(statement) {
            console.log('Passt alles');
        } else {
            console.log('Da fehlt was');
        }
    }

    const saveNewEquipment = async () => {
        
        let dbEntryTitle = titleRef.current.value.toLowerCase();
        dbEntryTitle = dbEntryTitle.replace('ä', 'ae');
        dbEntryTitle = dbEntryTitle.replace('ö', 'oe');
        dbEntryTitle = dbEntryTitle.replace('ü', 'ue');
        dbEntryTitle = dbEntryTitle.replace(' ', '_');
        const titleId = dbEntryTitle + uid(12);
        if(selectedCategory == 0) {
            await setDoc(doc(db, "equipment", titleId), {
                title: titleRef.current.value,
                description: descriptionRef.current.value,
                category: 0,
                contents: {
                    topBarAdd: topBarAddData.img,
                    topBar: topBarData.img,
                    foot: footData.img,
                    light01: light01Data.img,
                    light02: light02Data.img,
                    light03: light03Data.img,
                    light04: light04Data.img,
                    light05: light05Data.img,
                },
                titleId: titleId
            }).then(() => navigate('/'));
        } else if (selectedCategory == 1) {
            await setDoc(doc(db, "equipment", titleId), {
                title: titleRef.current.value,
                description: descriptionRef.current.value,
                category: 1,
                contents: {
                    img: otherCategoryData.img
                },
                titleId: titleId
            }).then(() => navigate('/'));
        }
    }

    return (
        <div className="NewEquipment">
            {blur ? <div className='blur'></div> : null}

            <Header pageName={'Neues Equipment'} />

            {topBarAddUpload ? <UploadImage category={selectedCategory} setUpload={setTopBarAddUpload} setBlur={setBlur} img={topBarAddData} setImg={setTopBarAddData} /> : null}
            {topBarUpload ? <UploadImage category={selectedCategory} setUpload={setTopBarUpload} setBlur={setBlur} img={topBarData} setImg={setTopBarData} /> : null}
            {footUpload ? <UploadImage category={selectedCategory} setUpload={setFootUpload} setBlur={setBlur} img={footData} setImg={setFootData} /> : null}
            {light01Upload ? <UploadImage category={selectedCategory} setUpload={setLight01Upload} setBlur={setBlur} img={light01Data} setImg={setLight01Data} /> : null}
            {light02Upload ? <UploadImage category={selectedCategory} setUpload={setLight02Upload} setBlur={setBlur} img={light02Data} setImg={setLight02Data} /> : null}
            {light03Upload ? <UploadImage category={selectedCategory} setUpload={setLight03Upload} setBlur={setBlur} img={light03Data} setImg={setLight03Data} /> : null}
            {light04Upload ? <UploadImage category={selectedCategory} setUpload={setLight04Upload} setBlur={setBlur} img={light04Data} setImg={setLight04Data} /> : null}
            {light05Upload ? <UploadImage category={selectedCategory} setUpload={setLight05Upload} setBlur={setBlur} img={light05Data} setImg={setLight05Data} /> : null}
            {otherCategoryUpload ? <UploadImage category={selectedCategory} setUpload={setOtherCategoryUpload} setBlur={setBlur} img={otherCategoryData} setImg={setOtherCategoryData} /> : null}

            <main>
                <div className="head"><Link to={'/'}><FontAwesomeIcon className='back-to-dashboard' icon={faArrowLeft} /></Link><h1>Neues Equipment anlegen</h1></div>

                <div className="form">
                    <div className="left">
                        <h3>Typ des Equipments</h3>
                        <div className="category-selection">
                            <p className={selectedCategory == 0 ? 'selected' : ''} onClick={() => setSelectedCategory(0)}>Ständer</p>
                            <p className={selectedCategory == 1 ? 'selected' : ''} onClick={() => setSelectedCategory(1)}>Anderes</p>
                        </div>

                        <h3>Name</h3>
                        <input className='equipment-name' id={titleRefMissing ? 'missing' : null} ref={titleRef} type="text" placeholder='Name des Equipments...' required />

                        <h3>Beschreibung</h3>
                        <textarea className='equipment-description' ref={descriptionRef} placeholder='Text der Beschreibung...'></textarea>
                    </div>
                    <div className={selectedCategory == 0 ? "right-0" : "right invisible"}>
                        {showTopBarAdd ? <img className='top-bar-add-img' src={topBarAddData.img} onClick={() => setTopBarAddUpload(true)} /> : <div className="top-bar-add" id={topBarAddMissing ? 'bar-missing' : null} title='Top Bar Add' onClick={() => setTopBarAddUpload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                        {showTopBar ? <img className='top-bar-img' src={topBarData.img} onClick={() => setTopBarUpload(true)} /> : <div className="top-bar" id={topBarMissing ? 'bar-missing' : null} title='Top Bar' onClick={() => setTopBarUpload(true)}><FontAwesomeIcon icon={faPlus} /></div>}                       
                        {showFoot ? <img className='foot-img' src={footData.img} onClick={() => setFootUpload(true)} /> : <div className="foot" title='Foot' id={footMissing ? 'bar-missing' : null} onClick={() => setFootUpload(true)}><FontAwesomeIcon icon={faPlus} /></div>  }      

                        <div className="lights">
                            <div className="light-container">
                                {showLight01 ? <img className='light-01-img' src={light01Data.img} onClick={() => setLight01Upload(true)} /> : <div id={light01Missing ? 'bar-missing' : null} className="light-01 light" title='Light 01' onClick={() => setLight01Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                                {showLight02 ? <img className='light-02-img' src={light02Data.img} onClick={() => setLight02Upload(true)} />: <div id={light02Missing ? 'bar-missing' : null} className="light-02 light" title='Light 02' onClick={() => setLight02Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}

                            </div>
                            {showLight03 ? <img className='light-03-img' src={light03Data.img} onClick={() => setLight03Upload(true)} /> : <div id={light03Missing ? 'bar-missing' : null} className="light-03 light" title='Light 03' onClick={() => setLight03Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                            <div className="light-container">
                                {showLight04 ? <img className='light-04-img' src={light04Data.img} onClick={() => setLight04Upload(true)} /> : <div id={light04Missing ? 'bar-missing' : null} className="light-04 light" title='Light 04' onClick={() => setLight04Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}                      
                                {showLight05 ? <img className='light-05-img' src={light05Data.img} onClick={() => setLight05Upload(true)} /> : <div id={light05Missing ? 'bar-missing' : null} className="light-05 light" title='Light 05' onClick={() => setLight05Upload(true)}><FontAwesomeIcon icon={faPlus} /></div>}
                            </div>
                        </div>
                    </div>

                    <div className={selectedCategory == 1 ? "right-1" : "right invisible"}>
                        {showOtherCategory ? <img className='other-category-img' src={otherCategoryData.img} onClick={() => setOtherCategoryUpload(true)} /> : <div id={otherCategoryMissing ? 'other-category-missing' : null} className="other-category" onClick={() => setOtherCategoryUpload(true)}>
                            <FontAwesomeIcon icon={faArrowUpFromBracket} />
                            <p>Bild einfügen</p>
                        </div>}
                    </div>

                    <FontAwesomeIcon onClick={saveNewEquipment} className='save-btn' icon={faFloppyDisk} type='submit' />
                </div>

                
            </main>
            
            <Footer />
        </div>
    );
};

export default NewEquipment;